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
import { renderHook } from "@/pageEditor/testHelpers";
import useSaveMod, { isModEditable } from "@/pageEditor/hooks/useSaveMod";
import { validateRegistryId } from "@/types/helpers";
import { act } from "@testing-library/react-hooks";
import { appApiMock } from "@/testUtils/appApiMock";
import { editablePackageMetadataFactory } from "@/testUtils/factories/registryFactories";
import notify from "@/utils/notify";
import { defaultModDefinitionFactory } from "@/testUtils/factories/modDefinitionFactories";
import { type SemVerString } from "@/types/registryTypes";
import modDefinitionRegistry from "@/modDefinitions/registry";
import { loadBrickYaml } from "@/runtime/brickYaml";
import { type ModDefinition } from "@/types/modDefinitionTypes";
import type { components } from "@/types/swagger";
import { editorSlice } from "@/pageEditor/slices/editorSlice";
import type { EditablePackageMetadata } from "@/types/contract";

const modId = validateRegistryId("@test/mod");

jest.mock("@/utils/notify", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock("@/components/ConfirmationModal", () => ({
  __esModule: true,
  useModals: () => ({
    showConfirmation: jest.fn().mockResolvedValue(true),
  }),
}));

describe("useSaveMod", () => {
  it("saves with no dirty changes", async () => {
    appApiMock.reset();

    const editablePackage = editablePackageMetadataFactory({
      name: modId,
    });

    const definition = defaultModDefinitionFactory({
      metadata: {
        id: editablePackage.name,
        name: editablePackage.verbose_name,
        version: editablePackage.version as SemVerString,
      },
    });

    // Register directly in modDefinitionRegistry because background call to sync with "/api/registry/bricks/" is mocked
    modDefinitionRegistry.register([
      {
        id: modId,
        ...definition,
      },
    ]);

    appApiMock.onGet("/api/bricks/").reply(200, [editablePackage]);

    appApiMock.onPut(`/api/bricks/${editablePackage.id}/`).reply(200, {});

    const { result, waitForEffect } = renderHook(() => useSaveMod(), {});

    await waitForEffect();

    await act(async () => {
      await result.current.save(modId);
    });

    expect(notify.success).toHaveBeenCalledWith("Saved mod");
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("preserves original options if no dirty options", async () => {
    appApiMock.reset();

    const editablePackage = editablePackageMetadataFactory({
      name: modId,
    });

    const definition = defaultModDefinitionFactory({
      metadata: {
        id: editablePackage.name,
        name: editablePackage.verbose_name,
        version: editablePackage.version as SemVerString,
      },
      options: {
        schema: {
          type: "object",
          properties: {
            test: {
              type: "string",
            },
          },
        },
      },
    });

    // Register directly in modDefinitionRegistry because background call to sync with "/api/registry/bricks/" is mocked
    // This data structure is not quite what happens in practice because the modDefinitionRegistry factory calls
    // normalizeModOptionsDefinition during hydration.
    modDefinitionRegistry.register([
      {
        id: modId,
        ...definition,
      },
    ]);

    appApiMock.onGet("/api/bricks/").reply(200, [editablePackage]);

    const putMock = appApiMock
      .onPut(`/api/bricks/${editablePackage.id}/`)
      .reply(200, {});

    const { result, waitForEffect } = renderHook(() => useSaveMod(), {});

    await waitForEffect();

    await act(async () => {
      await result.current.save(modId);
    });

    expect(notify.success).toHaveBeenCalledWith("Saved mod");

    const yamlConfig = (
      JSON.parse(
        putMock.history.put[0].data,
      ) as components["schemas"]["Package"]
    ).config;

    expect((loadBrickYaml(yamlConfig) as ModDefinition).options).toStrictEqual({
      schema: {
        type: "object",
        properties: {
          test: {
            type: "string",
          },
        },
      },
    });
  });

  it("saves dirty options", async () => {
    appApiMock.reset();

    const editablePackage = editablePackageMetadataFactory({
      name: modId,
    });

    const definition = defaultModDefinitionFactory({
      metadata: {
        id: editablePackage.name,
        name: editablePackage.verbose_name,
        version: editablePackage.version as SemVerString,
      },
    });

    // Register directly in modDefinitionRegistry because background call to sync with "/api/registry/bricks/" is mocked
    // This data structure is not quite what happens in practice because the modDefinitionRegistry factory calls
    // normalizeModOptionsDefinition during hydration.
    modDefinitionRegistry.register([
      {
        id: modId,
        ...definition,
      },
    ]);

    appApiMock.onGet("/api/bricks/").reply(200, [editablePackage]);

    const putMock = appApiMock
      .onPut(`/api/bricks/${editablePackage.id}/`)
      .reply(200, {});

    const { result, waitForEffect } = renderHook(() => useSaveMod(), {
      setupRedux(dispatch) {
        dispatch(editorSlice.actions.selectRecipeId(modId));
        dispatch(
          editorSlice.actions.editRecipeOptionsDefinitions({
            schema: {
              type: "object",
              properties: {
                test: {
                  type: "string",
                },
              },
            },
          }),
        );
      },
    });

    await waitForEffect();

    await act(async () => {
      await result.current.save(modId);
    });

    expect(notify.success).toHaveBeenCalledWith("Saved mod");

    const yamlConfig = (
      JSON.parse(
        putMock.history.put[0].data,
      ) as components["schemas"]["Package"]
    ).config;

    expect((loadBrickYaml(yamlConfig) as ModDefinition).options).toStrictEqual({
      schema: {
        type: "object",
        properties: {
          test: {
            type: "string",
          },
        },
      },
      uiSchema: {
        "ui:order": ["test", "*"],
      },
    });
  });
});

describe("isModEditable", () => {
  test("returns true if recipe is in editable packages", () => {
    const recipe = defaultModDefinitionFactory();
    const editablePackages: EditablePackageMetadata[] = [
      {
        id: null,
        name: validateRegistryId("test/recipe"),
      },
      {
        id: null,
        name: recipe.metadata.id,
      },
    ] as EditablePackageMetadata[];

    expect(isModEditable(editablePackages, recipe)).toBe(true);
  });

  test("returns false if recipe is not in editable packages", () => {
    const recipe = defaultModDefinitionFactory();
    const editablePackages: EditablePackageMetadata[] = [
      {
        id: null,
        name: validateRegistryId("test/recipe"),
      },
    ] as EditablePackageMetadata[];

    expect(isModEditable(editablePackages, recipe)).toBe(false);
  });

  test("returns false if recipe is null", () => {
    const editablePackages: EditablePackageMetadata[] = [
      {
        id: null,
        name: validateRegistryId("test/recipe"),
      },
    ] as EditablePackageMetadata[];

    expect(isModEditable(editablePackages, null)).toBe(false);
  });
});
