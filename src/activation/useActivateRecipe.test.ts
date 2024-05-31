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

import { type WizardValues } from "@/activation/wizardTypes";
import { renderHook } from "@/pageEditor/testHelpers";
import useActivateRecipe from "./useActivateRecipe";
import { validateRegistryId } from "@/types/helpers";
import { type StarterBrickDefinitionLike } from "@/starterBricks/types";
import { type ContextMenuDefinition } from "@/starterBricks/contextMenu/types";
import { uninstallRecipe } from "@/store/uninstallUtils";
import { type ModDefinition } from "@/types/modDefinitionTypes";
import extensionsSlice from "@/store/extensionsSlice";
import { type InnerDefinitions } from "@/types/registryTypes";
import { checkModDefinitionPermissions } from "@/modDefinitions/modDefinitionPermissionsHelpers";
import { emptyPermissionsFactory } from "@/permissions/permissionsUtils";
import databaseSchema from "@schemas/database.json";
import { set } from "lodash";
import {
  modComponentDefinitionFactory,
  starterBrickDefinitionFactory,
  defaultModDefinitionFactory,
} from "@/testUtils/factories/modDefinitionFactories";
import { metadataFactory } from "@/testUtils/factories/metadataFactory";
import { databaseFactory } from "@/testUtils/factories/databaseFactories";
import { reactivateEveryTab } from "@/contentScript/messenger/strict/api";
import { appApiMock } from "@/testUtils/appApiMock";
import type MockAdapter from "axios-mock-adapter";

jest.mock("@/contentScript/messenger/strict/api");

const checkPermissionsMock = jest.mocked(checkModDefinitionPermissions);
const uninstallRecipeMock = jest.mocked(uninstallRecipe);
const reactivateEveryTabMock = jest.mocked(reactivateEveryTab);

function setupInputs(): {
  formValues: WizardValues;
  modDefinition: ModDefinition;
} {
  const formValues: WizardValues = {
    extensions: { 0: true },
    integrationDependencies: [],
    optionsArgs: {},
  };

  const extensionPointId = validateRegistryId("test/starter-brick-1");
  const modComponentDefinition = modComponentDefinitionFactory({
    id: extensionPointId,
  });
  const starterBrickDefinition = starterBrickDefinitionFactory({
    metadata: metadataFactory({
      id: extensionPointId,
      name: "Text Starter Brick 1",
    }),
    definition: {
      type: "contextMenu",
      isAvailable: {
        matchPatterns: ["*://*/*"],
        selectors: [],
        urlPatterns: [],
      },
      reader: [validateRegistryId("@pixiebrix/document-metadata")],
    },
  }) as StarterBrickDefinitionLike<ContextMenuDefinition>;
  starterBrickDefinition.definition.targetMode = "eventTarget";
  starterBrickDefinition.definition.contexts = ["all"];
  starterBrickDefinition.definition.documentUrlPatterns = ["*://*/*"];

  const modDefinition = defaultModDefinitionFactory({
    extensionPoints: [modComponentDefinition],
    definitions: {
      [extensionPointId]: starterBrickDefinition,
    } as unknown as InnerDefinitions,
  });

  return {
    formValues,
    modDefinition,
  };
}

function setRecipeHasPermissions(hasPermissions: boolean) {
  checkPermissionsMock.mockResolvedValue({
    hasPermissions,
    // The exact permissions don't matter because we're mocking the check also
    permissions: emptyPermissionsFactory(),
  });
}

function setUserAcceptedPermissions(accepted: boolean) {
  jest.mocked(browser.permissions.request).mockResolvedValue(accepted);
}

describe("useActivateRecipe", () => {
  beforeEach(() => {
    reactivateEveryTabMock.mockClear();
  });

  it("returns error if permissions are not granted", async () => {
    const { formValues, modDefinition } = setupInputs();
    setRecipeHasPermissions(false);
    setUserAcceptedPermissions(false);

    const {
      result: { current: activateRecipe },
      getReduxStore,
    } = renderHook(() => useActivateRecipe("marketplace"), {
      setupRedux(dispatch, { store }) {
        jest.spyOn(store, "dispatch");
      },
    });

    const { success, error } = await activateRecipe(formValues, modDefinition);

    expect(success).toBe(false);
    expect(error).toBe("You must accept browser permissions to activate.");

    const { dispatch } = getReduxStore();

    expect(dispatch).not.toHaveBeenCalled();
    expect(uninstallRecipeMock).not.toHaveBeenCalled();
    expect(reactivateEveryTabMock).not.toHaveBeenCalled();
  });

  it("ignores permissions if flag set", async () => {
    const { formValues, modDefinition } = setupInputs();
    setRecipeHasPermissions(false);
    setUserAcceptedPermissions(false);

    const {
      result: { current: activateRecipe },
    } = renderHook(
      () => useActivateRecipe("marketplace", { checkPermissions: false }),
      {
        setupRedux(dispatch, { store }) {
          jest.spyOn(store, "dispatch");
        },
      },
    );

    const { success, error } = await activateRecipe(formValues, modDefinition);

    expect(success).toBe(true);
    expect(error).toBeUndefined();
  });

  it("calls uninstallRecipe, installs to extensionsSlice, and calls reactivateEveryTab, if permissions are granted", async () => {
    const { formValues, modDefinition } = setupInputs();
    setRecipeHasPermissions(false);
    setUserAcceptedPermissions(true);

    const {
      result: { current: activateRecipe },
      getReduxStore,
      act,
    } = renderHook(() => useActivateRecipe("extensionConsole"), {
      setupRedux(dispatch, { store }) {
        jest.spyOn(store, "dispatch");
      },
    });

    let success: boolean;
    let error: unknown;
    await act(async () => {
      const result = await activateRecipe(formValues, modDefinition);
      success = result.success;
      error = result.error;
    });

    expect(success).toBe(true);
    expect(error).toBeUndefined();

    const { dispatch } = getReduxStore();

    expect(uninstallRecipeMock).toHaveBeenCalledWith(
      modDefinition.metadata.id,
      expect.toBeArray(),
      dispatch,
    );

    expect(dispatch).toHaveBeenCalledWith(
      extensionsSlice.actions.activateMod({
        modDefinition,
        configuredDependencies: [],
        optionsArgs: {},
        screen: "extensionConsole",
        isReactivate: false,
      }),
    );

    expect(reactivateEveryTabMock).toHaveBeenCalledOnce();
  });

  it("handles auto-created personal databases successfully", async () => {
    const { formValues: inputFormValues, modDefinition: inputModDefinition } =
      setupInputs();
    const databaseName = "Auto-created Personal Test Database";
    const formValues = {
      ...inputFormValues,
      optionsArgs: {
        myDatabase: databaseName,
      },
    };
    const modDefinition: ModDefinition = {
      ...inputModDefinition,
      options: {
        schema: {
          ...inputModDefinition.options?.schema,
          properties: {
            ...inputModDefinition.options?.schema?.properties,
            myDatabase: {
              $ref: databaseSchema.$id,
              format: "preview",
            },
          },
        },
        uiSchema: inputModDefinition.options?.uiSchema,
      },
    };
    setRecipeHasPermissions(true);
    setUserAcceptedPermissions(true);

    const createdDatabase = databaseFactory({ name: databaseName });
    appApiMock.onPost("/api/databases/").reply(201, createdDatabase);

    const {
      result: { current: activateRecipe },
      getReduxStore,
      act,
    } = renderHook(() => useActivateRecipe("marketplace"), {
      setupRedux(dispatch, { store }) {
        jest.spyOn(store, "dispatch");
      },
    });

    let success: boolean;
    let error: unknown;
    await act(async () => {
      const result = await activateRecipe(formValues, modDefinition);
      success = result.success;
      error = result.error;
    });

    expect(success).toBe(true);
    expect(error).toBeUndefined();

    const { dispatch } = getReduxStore();

    expect(dispatch).toHaveBeenCalledWith(
      extensionsSlice.actions.activateMod({
        modDefinition,
        configuredDependencies: [],
        optionsArgs: {
          myDatabase: createdDatabase.id,
        },
        screen: "marketplace",
        isReactivate: false,
      }),
    );
  });

  const errorMessage = "Error creating database";
  const testCases = [
    {
      title: "handles network error in auto-created personal database",
      mockResponse(adapter: MockAdapter) {
        adapter.onPost("/api/databases/").networkError();
      },
    },
    {
      title: "handles error response in auto-created personal database request",
      mockResponse(adapter: MockAdapter) {
        adapter.onPost("/api/databases/").reply(400, { error: errorMessage });
      },
    },
  ];

  test.each(testCases)("$title", async ({ mockResponse }) => {
    mockResponse(appApiMock);

    const { formValues: inputFormValues, modDefinition: inputModDefinition } =
      setupInputs();
    const databaseName = "Auto-created Personal Test Database";
    const formValues = set(
      inputFormValues,
      "optionsArgs.myDatabase",
      databaseName,
    );
    const modDefinition = set(
      inputModDefinition,
      "options.schema.properties.myDatabase",
      {
        $ref: databaseSchema.$id,
        format: "preview",
      },
    );
    setRecipeHasPermissions(true);
    const errorMessage = "Error creating database";

    const {
      result: { current: activateRecipe },
      act,
    } = renderHook(() => useActivateRecipe("marketplace"), {
      setupRedux(dispatch, { store }) {
        jest.spyOn(store, "dispatch");
      },
    });

    let success: boolean;
    let error: unknown;
    await act(async () => {
      const result = await activateRecipe(formValues, modDefinition);
      success = result.success;
      error = result.error;
    });

    expect(success).toBe(false);
    expect(error).toBe(errorMessage);
  });
});
