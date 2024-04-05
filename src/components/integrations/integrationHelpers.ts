/*
 * Copyright (C) 2024 PixieBrix, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { getValidationErrMessages } from "@/components/fields/fieldUtils";
import {
  type IntegrationConfig,
  type Integration,
} from "@/integrations/integrationTypes";
import { type Schema } from "@/types/schemaTypes";
import { isRequired } from "@/utils/schemaUtils";
import { dereference } from "@/validators/schemaValidator";
import { type OutputUnit } from "@cfworker/json-schema";
import { type FormikErrors } from "formik";
import { cloneDeep, set } from "lodash";
import { f } from "node_modules/msw/lib/glossary-de6278a9";
import { buildYup } from "schema-to-yup";
import * as Yup from "yup";

export function convertSchemaToConfigState(inputSchema: Schema): UnknownObject {
  const result: UnknownObject = {};
  for (const [key, value] of Object.entries(inputSchema.properties ?? {})) {
    if (
      typeof value === "boolean" ||
      value.type === "null" ||
      !isRequired(inputSchema, key)
    ) {
      continue;
    }

    if (value.type === "object") {
      // eslint-disable-next-line security/detect-object-injection -- Schema property keys
      result[key] = convertSchemaToConfigState(value);
    } else {
      if (value.default !== undefined) {
        // eslint-disable-next-line security/detect-object-injection -- Schema property keys
        result[key] = value.default;
        continue;
      }

      switch (value.type) {
        case "boolean": {
          // eslint-disable-next-line security/detect-object-injection -- Schema property keys
          result[key] = false;
          break;
        }

        case "number":
        case "integer": {
          // eslint-disable-next-line security/detect-object-injection -- Schema property keys
          result[key] = 0;
          break;
        }

        case "array": {
          // eslint-disable-next-line security/detect-object-injection -- Schema property keys
          result[key] = [];
          break;
        }

        default: {
          // eslint-disable-next-line security/detect-object-injection -- Schema property keys
          result[key] = "";
          break;
        }
      }
    }
  }

  return result;
}

export function buildSchema(integration: Integration): Schema {
  return {
    type: "object",
    properties: {
      organization: {
        type: "string",
      },
      label: {
        type: "string",
        // @ts-expect-error -- expects JSONSchema7 type `required: string[]`
        // (one level up), but only works with JSONSchema4 `required: boolean`
        required: true,
      },
      config: integration.schema,
    },
    required: ["config"],
  };
}

export async function createYupValidationSchema(
  integration: Integration,
): Promise<Yup.AnyObjectSchema> {
  try {
    const schema = buildSchema(integration);

    // Dereference because buildYup doesn't support $ref:
    // https://github.com/kristianmandrup/schema-to-yup?tab=readme-ov-file#refs
    const dereferencedSchema = await dereference(schema, {
      // Include secrets, so they can be validated
      sanitizeIntegrationDefinitions: false,
    });

    // The de-referenced schema is frozen, buildYup can mutate it, so we need to "unfreeze" the schema
    return buildYup(cloneDeep(dereferencedSchema), {
      errMessages: getValidationErrMessages(
        schema.properties?.config as Schema,
      ),
      logging: true,
      logDetailed: [{ key: "folderId" }],
    });
  } catch (error) {
    reportError(
      new Error("Error building Yup validator from JSON Schema", {
        cause: error,
      }),
    );
    return Yup.object();
  }
}

export function convertInstanceLocationToFormikPath(
  instanceLocation: string,
): string {
  return instanceLocation.replace("#/", "").replaceAll("/", ".");
}

export function convertSchemaErrorsToFormikErrors(
  schemaErrors: OutputUnit[],
): FormikErrors<IntegrationConfig> {
  const errors = {};

  const filteredErrors = schemaErrors.filter(
    (error) => !["#", "#/config"].includes(error.instanceLocation),
  );

  for (const { error, instanceLocation } of filteredErrors) {
    const formikPath = convertInstanceLocationToFormikPath(instanceLocation);
    set(errors, formikPath, error);
  }

  return errors;
}
