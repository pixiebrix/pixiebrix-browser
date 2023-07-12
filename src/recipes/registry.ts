/*
 * Copyright (C) 2023 PixieBrix, Inc.
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

import BaseRegistry from "@/baseRegistry";
import { propertiesToSchema } from "@/validators/generic";
import produce from "immer";
import { sortBy } from "lodash";
import {
  type Schema,
  type SchemaProperties,
  type UiSchema,
} from "@/types/schemaTypes";
import {
  type OptionsDefinition,
  type ModDefinition,
} from "@/types/modDefinitionTypes";
import { type RegistryId } from "@/types/registryTypes";

type UnnormalizedOptionsDefinition = {
  schema: Schema | SchemaProperties;
  uiSchema?: UiSchema;
};

type UnnormalizedModDefinition = Exclude<ModDefinition, "options"> & {
  options?: UnnormalizedOptionsDefinition;
};

type RegistryModDefinition = ModDefinition & {
  id: RegistryId;
};

/**
 * Fix hand-crafted recipe options from the workshop
 */
function normalizeRecipeOptions(
  options?: OptionsDefinition
): OptionsDefinition {
  if (options == null) {
    return {
      schema: {},
      uiSchema: {},
    };
  }

  const recipeSchema = options.schema ?? {};
  const schema: Schema =
    "type" in recipeSchema &&
    recipeSchema.type === "object" &&
    "properties" in recipeSchema
      ? recipeSchema
      : propertiesToSchema(recipeSchema as SchemaProperties);
  const uiSchema: UiSchema = options.uiSchema ?? {};
  uiSchema["ui:order"] = uiSchema["ui:order"] ?? [
    ...sortBy(Object.keys(schema.properties ?? {})),
    "*",
  ];
  return { schema, uiSchema };
}

function fromJS(rawRecipe: UnnormalizedModDefinition) {
  return produce(rawRecipe, (draft) => {
    draft.options = normalizeRecipeOptions(rawRecipe.options);
    (draft as RegistryModDefinition).id = rawRecipe.metadata.id;
  }) as RegistryModDefinition;
}

const registry = new BaseRegistry<RegistryId, RegistryModDefinition>(
  ["recipe"],
  fromJS
);

export default registry;
