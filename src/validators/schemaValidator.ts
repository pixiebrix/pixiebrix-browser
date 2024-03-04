/* eslint-disable security/detect-object-injection */
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

import {
  type Schema as ValidatorSchema,
  type ValidationResult,
  Validator,
} from "@cfworker/json-schema";
import { type Schema } from "@/types/schemaTypes";
import integrationRegistry from "@/integrations/registry";
import { cloneDeep, pickBy, trimEnd } from "lodash";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import {
  type FileInfo,
  type ResolverOptions,
} from "@apidevtools/json-schema-ref-parser/dist/lib/types";
import draft07 from "@schemas/draft-07.json";
import serviceSchema from "@schemas/service.json";
import readerSchema from "@schemas/reader.json";
import extensionPointSchema from "@schemas/extensionPoint.json";
import iconSchema from "@schemas/icon.json";
import recipeSchema from "@schemas/recipe.json";
import keySchema from "@schemas/key.json";
import metadataSchema from "@schemas/metadata.json";
import innerDefinitionSchema from "@schemas/innerDefinition.json";
import refSchema from "@schemas/ref.json";
import componentSchema from "@schemas/component.json";
import pipelineSchema from "@schemas/pipeline.json";
import databaseSchema from "@schemas/database.json";
import elementSchema from "@schemas/element.json";
import googleSheetIdSchema from "@schemas/googleSheetId.json";
import { inputProperties, minimalSchemaFactory } from "@/utils/schemaUtils";
import { validateRegistryId } from "@/types/helpers";
import type { JSONSchema7 } from "json-schema";

const BUILT_IN_SCHEMAS: Readonly<Record<string, ValidatorSchema>> =
  Object.freeze({
    "http://json-schema.org/draft-07/schema": draft07,
    "https://app.pixiebrix.com/schemas/metadata": metadataSchema,
    "https://app.pixiebrix.com/schemas/key": keySchema,
    "https://app.pixiebrix.com/schemas/service": serviceSchema,
    "https://app.pixiebrix.com/schemas/extensionPoint": extensionPointSchema,
    "https://app.pixiebrix.com/schemas/icon": iconSchema,
    "https://app.pixiebrix.com/schemas/recipe": recipeSchema,
    "https://app.pixiebrix.com/schemas/reader": readerSchema,
    "https://app.pixiebrix.com/schemas/pipeline": pipelineSchema,
    "https://app.pixiebrix.com/schemas/component": componentSchema,
    "https://app.pixiebrix.com/schemas/ref": refSchema,
    "https://app.pixiebrix.com/schemas/innerDefinition": innerDefinitionSchema,
    "https://app.pixiebrix.com/schemas/database": databaseSchema,
    "https://app.pixiebrix.com/schemas/element": elementSchema,
    "https://app.pixiebrix.com/schemas/googleSheetId": googleSheetIdSchema,
  } as unknown as Record<string, ValidatorSchema>);

const REF_SECRETS = ["https://app.pixiebrix.com/schemas/key"];

export const KIND_SCHEMAS: Readonly<Record<string, ValidatorSchema>> =
  Object.freeze({
    service: serviceSchema,
    reader: readerSchema,
    extensionPoint: extensionPointSchema,
    recipe: recipeSchema,
    component: componentSchema,
  } as unknown as Record<string, ValidatorSchema>);

/**
 * $ref resolver factory that fetches the integration definition from the integration definition registry.
 * @param sanitize true to exclude properties associated with secrets
 */
function integrationResolverFactory({
  sanitize,
}: {
  sanitize: boolean;
}): ResolverOptions {
  return {
    order: 1,
    canRead: /^https:\/\/app\.pixiebrix\.com\/schemas\/services\/\S+/i,
    async read(file: FileInfo) {
      // https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API#making_matching_groups_repeated
      const pattern = new URLPattern({ pathname: "/schemas/services/:id+" });
      const result = pattern.exec(file.url);

      if (!result) {
        throw new Error(`Invalid integration URL ${file.url}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion,@typescript-eslint/no-unnecessary-type-assertion -- linter and compiler disagree
      const integrationId = result.pathname.groups.id!;

      try {
        const integrationDefinition = await integrationRegistry.lookup(
          validateRegistryId(integrationId),
        );

        if (sanitize) {
          const sanitizedProperties = pickBy(
            inputProperties(integrationDefinition.schema),
            // `includes` type is annoyingly narrow: https://github.com/microsoft/TypeScript/issues/26255
            (x: JSONSchema7) =>
              x.$ref == null || !REF_SECRETS.includes(trimEnd(x.$ref, "#")),
          );

          return {
            // XXX: leave off $id because $RefParser.dereference throws on duplicate $ids in a schema?
            //   In practice, bricks won't have more than one integration per type
            //   Leaving $id off might cause problems with field toggle logic in the UI
            $id: file.url,
            type: "object",
            // Strip out the properties containing secrets because those are excluded during runtime execution
            properties: sanitizedProperties,
            required: (integrationDefinition.schema.required ?? []).filter(
              (x) => x in sanitizedProperties,
            ),
          };
        }

        return {
          ...integrationDefinition.schema,
          $id: file.url,
        };
      } catch (error) {
        console.warn("Error resolving integration definition schema", error);
        // Don't block on lookup failure
        return minimalSchemaFactory();
      }
    },
  };
}

/**
 * Schema resolver that resolves the schemas from BUILT_IN_SCHEMA_URLS.
 */
// eslint-disable-next-line local-rules/persistBackgroundData -- Static
const builtInSchemaResolver: ResolverOptions = {
  // XXX: order after integrationDefinitionResolver, which is more specific. Or considering combining?
  order: 2,
  canRead: /^https?:\/\//i,
  async read(file: FileInfo) {
    const url = trimEnd(file.url, "#");

    const schema = BUILT_IN_SCHEMAS[url];

    if (schema != null) {
      // XXX: strip off $id because $RefParser.dereference on duplicate $ids in a schema
      //  However, leaving off the $id might cause problems with field toggle logic in the UI?
      const { $id, ...other } = schema;
      return other;
    }

    throw new Error(`Unknown schema: ${file.url}`);
  },
} as const;

/**
 * Returns a new copy of schema with all $ref de-referenced.
 * @param schema the original schema that may contain $ref
 * @param sanitizeIntegrationDefinitions remove properties associated with secrets from integration definitions.
 *   Should generally be set to true when using for runtime validation, but false when using for UI entry validation.
 * @see $RefParser.dereference
 */
export async function dereference(
  schema: Schema,
  {
    sanitizeIntegrationDefinitions,
  }: {
    sanitizeIntegrationDefinitions: boolean;
  },
): Promise<Schema> {
  // $RefParser.dereference modifies the schema in place
  const clone = cloneDeep(schema);

  try {
    return await ($RefParser.dereference(clone, {
      resolve: {
        integrationDefinitionResolver: integrationResolverFactory({
          sanitize: sanitizeIntegrationDefinitions,
        }),
        builtInSchemaResolver,
        // Disable built-in resolvers: https://apitools.dev/json-schema-ref-parser/docs/options.html
        http: false,
        file: false,
      },
      dereference: {
        circular: "ignore",
      },
    }) as Promise<Schema>);
  } catch (rawError) {
    const errorMessage = `Failed to dereference schema: ${JSON.stringify(
      schema,
    )}`;
    throw new Error(errorMessage, {
      cause: rawError,
    });
  }
}

/**
 * Asynchronously validate an input/output value of a brick against a brick schema.
 *
 * Dereferences any `$ref`s in the schema.
 *
 * To avoid secret leakage, does not validate the secret `$ref`s of properties accepting an integration configuration.
 */
export async function validateBrickInputOutput(
  schema: Schema,
  instance: unknown,
): Promise<ValidationResult> {
  // XXX: we might consider using resolve and adding the schemas to the validator vs. de-referencing
  // The problem is that the validator in errors change, so we'd have to double-check our translation from
  // validation errors to field paths for the Page Editor.
  // https://apitools.dev/json-schema-ref-parser/docs/ref-parser.html#resolveschema-options-callback

  const dereferenced = await dereference(schema, {
    sanitizeIntegrationDefinitions: true,
  });

  const validator = new Validator(dereferenced as ValidatorSchema);
  return validator.validate(instance ?? null);
}

/**
 * Synchronously validates a package definition against the schema for its kind.
 *
 * Does not de-reference the schema because that would be async. All the built-ins are included in the extension
 * distribution, so they are available to be added directly.
 *
 * @param kind the package definition kind.
 * @param instance the package definition
 */
export function validatePackageDefinition(
  kind: keyof typeof KIND_SCHEMAS,
  instance: unknown,
): ValidationResult {
  const schema = KIND_SCHEMAS[kind];

  if (schema == null) {
    // `strictNullChecks` isn't satisfied with the keyof parameter type
    throw new Error(`Unknown kind: ${kind}`);
  }

  const validator = new Validator(schema);

  // Add the schemas synchronously
  for (const builtIn of Object.values(BUILT_IN_SCHEMAS)) {
    if (builtIn !== schema) {
      // `validate` throws if there are multiple schemas registered with the same $id
      validator.addSchema(builtIn);
    }
  }

  return validator.validate(instance);
}
