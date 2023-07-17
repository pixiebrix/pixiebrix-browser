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

import {
  generateRecipeId,
  getContainedExtensionPointTypes,
} from "./recipeUtils";
import {
  modComponentDefinitionFactory,
  recipeFactory,
} from "@/testUtils/factories/modDefinitionFactories";
import extensionPointRegistry from "@/starterBricks/registry";

extensionPointRegistry.lookup = jest.fn();

describe("generateRecipeId", () => {
  test("no special chars", () => {
    expect(generateRecipeId("@test", "This Is a Test")).toEqual(
      "@test/this-is-a-test"
    );
  });

  test("handle colon", () => {
    expect(generateRecipeId("@test", "This: Is a Test")).toEqual(
      "@test/this-is-a-test"
    );
  });

  test("collapse spaces", () => {
    expect(generateRecipeId("@test", "This   Is a Test")).toEqual(
      "@test/this-is-a-test"
    );
  });

  test("return empty on invalid", () => {
    expect(generateRecipeId("", "This   Is a Test")).toBe("");
  });
});

describe("getContainedExtensionPointTypes", () => {
  test("gets types with inner definitions", async () => {
    const result = await getContainedExtensionPointTypes(recipeFactory());
    expect(result).toStrictEqual(["menuItem"]);
  });

  test("returns only unique types", async () => {
    const result = await getContainedExtensionPointTypes(
      recipeFactory({
        extensionPoints: [
          modComponentDefinitionFactory(),
          modComponentDefinitionFactory(),
        ],
      })
    );
    expect(result).toStrictEqual(["menuItem"]);
  });

  test("gets types without inner definitions", async () => {
    (extensionPointRegistry.lookup as jest.Mock).mockImplementation(() => ({
      kind: "menuItem",
    }));

    const result = await getContainedExtensionPointTypes(
      recipeFactory({
        extensionPoints: [modComponentDefinitionFactory()],
        definitions: undefined,
      })
    );

    expect(result).toStrictEqual(["menuItem"]);
  });

  test("returns non-null values", async () => {
    (extensionPointRegistry.lookup as jest.Mock).mockImplementation(() => null);

    const result = await getContainedExtensionPointTypes(
      recipeFactory({
        extensionPoints: [modComponentDefinitionFactory()],
        definitions: undefined,
      })
    );

    expect(result).toStrictEqual([]);
  });

  test("inner definition not found", async () => {
    (extensionPointRegistry.lookup as jest.Mock).mockImplementation(() => null);

    const result = await getContainedExtensionPointTypes(
      recipeFactory({
        extensionPoints: [modComponentDefinitionFactory()],
        definitions: {},
      })
    );

    expect(result).toStrictEqual([]);
  });
});
