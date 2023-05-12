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

import React from "react";
import { useRequiredRecipe } from "@/recipes/recipesHooks";
import { render } from "@/sidebar/testHelpers";
import ActivateRecipePanel from "@/sidebar/activateRecipe/ActivateRecipePanel";
import sidebarSlice from "@/sidebar/sidebarSlice";
import { waitForEffect } from "@/testUtils/testHelpers";
import { propertiesToSchema } from "@/validators/generic";
import registerDefaultWidgets from "@/components/fields/schemaFields/widgets/registerDefaultWidgets";
import useQuickbarShortcut from "@/hooks/useQuickbarShortcut";
import { type RecipeDefinition } from "@/types/recipeTypes";
import includesQuickBarExtensionPoint from "@/utils/includesQuickBarExtensionPoint";
import { valueToAsyncCacheState } from "@/utils/asyncStateUtils";
import { validateRegistryId } from "@/types/helpers";
import { checkRecipePermissions } from "@/recipes/recipePermissionsHelpers";
import { appApiMock, onDeferredGet } from "@/testUtils/appApiMock";
import {
  getRecipeWithBuiltInServiceAuths,
  recipeDefinitionFactory,
} from "@/testUtils/factories/recipeFactories";
import { sidebarEntryFactory } from "@/testUtils/factories/sidebarEntryFactories";
import {
  marketplaceListingFactory,
  recipeToMarketplacePackage,
} from "@/testUtils/factories/marketplaceFactories";

jest.mock("@/recipes/recipesHooks", () => ({
  useRequiredRecipe: jest.fn(),
}));

const useRequiredRecipeMock = jest.mocked(useRequiredRecipe);
const checkRecipePermissionsMock = jest.mocked(checkRecipePermissions);

jest.mock("@/utils/includesQuickBarExtensionPoint", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(true),
}));

const includesQuickBarMock = jest.mocked(includesQuickBarExtensionPoint);

jest.mock("@/registry/internal", () => ({
  // We're also mocking all the functions that this output is passed to, so we can return empty array
  resolveRecipe: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/hooks/useQuickbarShortcut", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const useQuickbarShortcutMock = jest.mocked(useQuickbarShortcut);

jest.mock("@/activation/useActivateRecipe", () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(async () => ({ success: true })),
}));

beforeAll(() => {
  registerDefaultWidgets();
});

function setupMocksAndRender(recipeOverride?: Partial<RecipeDefinition>) {
  const recipe = recipeDefinitionFactory({
    ...recipeOverride,
    metadata: {
      id: validateRegistryId("test-recipe"),
      name: "Test Mod",
    },
  });
  useRequiredRecipeMock.mockReturnValue(valueToAsyncCacheState(recipe));
  const listing = marketplaceListingFactory({
    // Consistent user-visible name for snapshots
    package: recipeToMarketplacePackage(recipe),
  });

  // Tests can override by calling before setupMocksAndRender
  appApiMock.onGet("/api/marketplace/listings/").reply(200, [listing]);
  appApiMock.onGet().reply(200, []);

  const entry = sidebarEntryFactory("activateRecipe", {
    recipeId: recipe.metadata.id,
    heading: "Activate Mod",
  });

  return render(<ActivateRecipePanel recipeId={recipe.metadata.id} />, {
    setupRedux(dispatch) {
      dispatch(sidebarSlice.actions.showActivateRecipe(entry));
    },
  });
}

beforeEach(() => {
  appApiMock.reset();

  includesQuickBarMock.mockResolvedValue(false);

  useQuickbarShortcutMock.mockReturnValue({
    shortcut: null,
    isConfigured: false,
  });

  checkRecipePermissionsMock.mockResolvedValue({
    hasPermissions: true,
    permissions: {},
  });
});

describe("ActivateRecipePanel", () => {
  it("renders with options, permissions info", async () => {
    jest.mocked(checkRecipePermissions).mockResolvedValue({
      hasPermissions: false,
      permissions: { origins: ["https://newurl.com"] },
    });

    const rendered = setupMocksAndRender({
      options: {
        schema: propertiesToSchema({
          foo: {
            type: "string",
          },
          bar: {
            type: "number",
          },
          testDatabase: {
            $ref: "https://app.pixiebrix.com/schemas/database#",
            title: "Test Database",
          },
        }),
      },
    });

    await waitForEffect();

    rendered.debug();

    expect(rendered.asFragment()).toMatchSnapshot();
  });

  it("activates basic recipe automatically and renders well-done page", async () => {
    const rendered = setupMocksAndRender();

    await waitForEffect();

    expect(rendered.asFragment()).toMatchSnapshot();
  });

  it("activates basic recipe with empty options structure automatically and renders well-done page", async () => {
    const rendered = setupMocksAndRender({
      options: {
        schema: {},
      },
    });

    await waitForEffect();

    expect(rendered.asFragment()).toMatchSnapshot();
  });

  it("activates recipe with database preview automatically and renders well-done page", async () => {
    const rendered = setupMocksAndRender({
      options: {
        schema: propertiesToSchema({
          testDatabase: {
            $ref: "https://app.pixiebrix.com/schemas/database#",
            title: "Database",
            format: "preview",
          },
        }),
      },
    });

    await waitForEffect();

    expect(rendered.asFragment()).toMatchSnapshot();
  });

  it("renders well-done page for quick bar mod shortcut not configured", async () => {
    includesQuickBarMock.mockResolvedValue(true);

    const rendered = setupMocksAndRender();

    await waitForEffect();

    expect(rendered.asFragment()).toMatchSnapshot();
  });

  it("renders well-done page for quick bar mod shortcut is configured on MacOS", async () => {
    includesQuickBarMock.mockResolvedValue(true);

    useQuickbarShortcutMock.mockReturnValue({
      shortcut: "⌘M",
      isConfigured: true,
    });

    const rendered = setupMocksAndRender();

    await waitForEffect();

    expect(rendered.asFragment()).toMatchSnapshot();
  });

  it("renders well-done page for quick bar mod shortcut is configured on Windows", async () => {
    includesQuickBarMock.mockResolvedValue(true);

    useQuickbarShortcutMock.mockReturnValue({
      shortcut: "Ctrl+M",
      isConfigured: true,
    });

    const rendered = setupMocksAndRender();

    await waitForEffect();

    expect(rendered.asFragment()).toMatchSnapshot();
  });

  it("renders with service configuration if no built-in service configs available", async () => {
    const { recipe } = getRecipeWithBuiltInServiceAuths();

    const rendered = setupMocksAndRender(recipe);

    await waitForEffect();

    expect(rendered.asFragment()).toMatchSnapshot();
    expect(
      rendered.container.querySelector(".actionButton")
    ).not.toBeDisabled();
  });

  it("activates recipe with built-in services automatically and renders well-done page", async () => {
    const { recipe, builtInServiceAuths } = getRecipeWithBuiltInServiceAuths();

    appApiMock.onGet("/api/services/shared/").reply(200, builtInServiceAuths);

    const rendered = setupMocksAndRender(recipe);

    await waitForEffect();

    expect(rendered.asFragment()).toMatchSnapshot();
  });

  it("doesn't flicker while built-in auths are loading", async () => {
    const { recipe } = getRecipeWithBuiltInServiceAuths();

    onDeferredGet("/api/services/shared/");

    const rendered = setupMocksAndRender(recipe);

    await waitForEffect();

    expect(rendered.getByTestId("loader")).not.toBeNull();
  });
});
