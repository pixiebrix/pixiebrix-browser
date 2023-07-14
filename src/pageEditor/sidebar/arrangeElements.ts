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

import { groupBy, lowerCase, sortBy } from "lodash";
import { type ModDefinition } from "@/types/modDefinitionTypes";
import {
  type ModComponentFormState,
  isModComponentFormState,
} from "@/pageEditor/starterBricks/formStateTypes";
import { getRecipeById } from "@/pageEditor/utils";
import { isModComponentBase } from "@/pageEditor/sidebar/common";
import { type UUID } from "@/types/stringTypes";
import { type ModComponentBase } from "@/types/modComponentTypes";
import { type RegistryId } from "@/types/registryTypes";

type ArrangeElementsArgs = {
  elements: ModComponentFormState[];
  installed: ModComponentBase[];
  recipes: ModDefinition[];
  activeElementId: UUID | null;
  activeRecipeId: RegistryId | null;
  query: string;
};

type Element = ModComponentBase | ModComponentFormState;

function arrangeElements({
  elements,
  installed,
  recipes,
  activeElementId,
  activeRecipeId,
  query,
}: ArrangeElementsArgs): Array<Element | [RegistryId, Element[]]> {
  const elementIds = new Set(elements.map((formState) => formState.uuid));

  const queryFilter = (item: ModComponentBase | ModComponentFormState) => {
    const recipe = isModComponentFormState(item) ? item.recipe : item._recipe;
    const queryName = recipe?.name ?? item.label;

    return (
      activeRecipeId === recipe?.id ||
      query.length === 0 ||
      (isModComponentFormState(item) && activeElementId === item.uuid) ||
      (query.length > 0 && lowerCase(queryName).includes(lowerCase(query)))
    );
  };

  const filteredExtensions: ModComponentBase[] = installed
    // Note: we can take out this elementIds filter if and when we persist the editor
    // slice and remove installed extensions when they become dynamic elements
    .filter((extension) => !elementIds.has(extension.id))
    .filter((extension) => queryFilter(extension));

  const filteredDynamicElements: ModComponentFormState[] = elements.filter(
    (element) => queryFilter(element)
  );

  const grouped = groupBy(
    [...filteredExtensions, ...filteredDynamicElements],
    (extension) =>
      isModComponentBase(extension)
        ? extension._recipe?.id
        : extension.recipe?.id
  );

  const _elementsByRecipeId = new Map<string, Element[]>(
    Object.entries(grouped)
  );
  for (const elements of _elementsByRecipeId.values()) {
    elements.sort((a, b) =>
      lowerCase(a.label).localeCompare(lowerCase(b.label))
    );
  }

  const orphanedElements = _elementsByRecipeId.get("undefined") ?? [];
  _elementsByRecipeId.delete("undefined");
  const unsortedElements = [
    ...(_elementsByRecipeId as Map<RegistryId, Element[]>),
    ...orphanedElements,
  ];

  const sortedElements = sortBy(unsortedElements, (item) => {
    if (!Array.isArray(item)) {
      return lowerCase(item.label);
    }

    const [recipeId, elements] = item;
    const recipe = getRecipeById(recipes, recipeId);
    if (recipe) {
      return lowerCase(recipe?.metadata?.name ?? "");
    }

    // Look for a recipe name in the elements/extensions in case recipes are still loading
    for (const element of elements) {
      const name = isModComponentBase(element)
        ? element._recipe?.name
        : element.recipe?.name;
      if (name) {
        return lowerCase(name);
      }
    }

    return "";
  });

  return sortedElements;
}

export default arrangeElements;
