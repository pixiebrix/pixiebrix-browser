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

import type { SyncPolicy } from "@/platform/state/stateTypes";
import type { ModVariablesDefinition } from "@/types/modDefinitionTypes";
import { sortBy } from "lodash";
import { uuidv4 } from "@/types/helpers";
import { propertiesToSchema } from "@/utils/schemaUtils";
import {
  type ModVariable,
  type ModVariableFormValues,
  SYNC_OPTIONS,
  TYPE_OPTIONS,
} from "@/pageEditor/tabs/modVariablesDefinition/modVariablesDefinitionEditorTypes";
import type { JSONSchema7Definition } from "json-schema";
import type { Schema } from "@/types/schemaTypes";
import type { Nullishable } from "@/utils/nullishUtils";

/**
 * Casts a value to a SyncPolicy, defaulting to "none" if the value is nullish or not recognized.
 */
function castSyncPolicy(value: unknown): SyncPolicy {
  return SYNC_OPTIONS.find((x) => x.value === value)?.value ?? "none";
}

/**
 * Casts a value to a type, defaulting to "any" if the value is nullish or not recognized.
 */
function castType(value: unknown): (typeof TYPE_OPTIONS)[number]["value"] {
  return TYPE_OPTIONS.find((x) => x.value === value)?.value ?? "any";
}

/**
 * Returns true if a schema's properties correspond to an async mod variable declaration.
 */
function isAsyncModVariableProperties(
  properties: Nullishable<Schema["properties"]>,
) {
  return (
    properties != null &&
    Object.hasOwn(properties, "isSuccess") &&
    Object.hasOwn(properties, "isFetching") &&
    Object.hasOwn(properties, "data")
  );
}

export function mapDefinitionToFormValues({
  schema,
}: ModVariablesDefinition): ModVariableFormValues {
  const variables = sortBy(
    Object.entries(schema.properties ?? {})
      .map(([name, value]) => {
        if (value === false) {
          return null;
        }

        if (value === true) {
          return {
            formReactKey: uuidv4(),
            name,
            isAsync: false,
            syncPolicy: "none",
            type: "any",
          } satisfies ModVariable;
        }

        const { description, properties } = value;

        const isAsync = isAsyncModVariableProperties(properties);

        return {
          formReactKey: uuidv4(),
          name,
          description,
          isAsync,
          type: isAsync ? castType(value.data.type) : castType(value.type),
          syncPolicy: castSyncPolicy((value as UnknownObject)["x-sync-policy"]),
        };
      })
      .filter((x) => x != null),
    (x) => x.name,
  );

  return { variables };
}

function typeToAsyncState(
  dataDefinition: JSONSchema7Definition,
): Exclude<JSONSchema7Definition, boolean> {
  return {
    type: "object",
    properties: {
      isLoading: {
        type: "boolean",
      },
      isFetching: {
        type: "boolean",
      },
      isSuccess: {
        type: "boolean",
      },
      isError: {
        type: "boolean",
      },
      currentData: dataDefinition,
      data: dataDefinition,
      error: {
        type: "object",
      },
    },
    required: ["isLoading", "isFetching", "isSuccess", "isError"],
  };
}

export function mapFormValuesToDefinition(
  formValues: ModVariableFormValues,
): ModVariablesDefinition {
  const schema = propertiesToSchema(
    Object.fromEntries(
      formValues.variables.map((variable) => [
        variable.name,
        {
          description: variable.description,
          ...(variable.isAsync
            ? typeToAsyncState({ type: variable.type })
            : { type: variable.type }),
          "x-sync-policy": variable.syncPolicy,
        },
      ]),
    ),
    [],
  );

  return { schema };
}
