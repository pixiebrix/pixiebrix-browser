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

import React from "react";
import { useRequiredModDefinitions } from "@/modDefinitions/modDefinitionHooks";
import { render, screen } from "@/sidebar/testHelpers";
import ActivateModPanel from "@/sidebar/activateMod/ActivateModPanel";
import sidebarSlice from "@/sidebar/sidebarSlice";
import { waitForEffect } from "@/testUtils/testHelpers";
import { propertiesToSchema } from "@/validators/generic";
import registerDefaultWidgets from "@/components/fields/schemaFields/widgets/registerDefaultWidgets";
import useQuickbarShortcut from "@/hooks/useQuickbarShortcut";
import { type ModDefinition } from "@/types/modDefinitionTypes";
import { valueToAsyncCacheState } from "@/utils/asyncStateUtils";
import { validateRegistryId } from "@/types/helpers";
import { checkModDefinitionPermissions } from "@/modDefinitions/modDefinitionPermissionsHelpers";
import { appApiMock, onDeferredGet } from "@/testUtils/appApiMock";
import {
  defaultModDefinitionFactory,
  getModDefinitionWithBuiltInIntegrationConfigs,
  modComponentDefinitionFactory,
} from "@/testUtils/factories/modDefinitionFactories";
import { sidebarEntryFactory } from "@/testUtils/factories/sidebarEntryFactories";
import {
  marketplaceListingFactory,
  modDefinitionToMarketplacePackage,
} from "@/testUtils/factories/marketplaceFactories";
import * as messengerApi from "@/contentScript/messenger/api";
import ActivateMultipleModsPanel from "@/sidebar/activateMod/ActivateMultipleModsPanel";
import ErrorBoundary from "@/sidebar/SidebarErrorBoundary";
import { includesQuickBarStarterBrick } from "@/starterBricks/starterBrickModUtils";
import { SERVICES_BASE_SCHEMA_URL } from "@/integrations/util/makeServiceContextFromDependencies";
import { generateIntegrationAndRemoteConfig } from "@/testUtils/factories/integrationFactories";
import { registry, services } from "@/background/messenger/api";
import { clear, find, syncPackages } from "@/registry/packageRegistry";
import { refreshRegistries } from "@/hooks/useRefreshRegistries";
import { refreshServices } from "@/background/locator";
import { type WizardValues } from "@/activation/wizardTypes";
import useActivateRecipe, {
  type ActivateResult,
} from "@/activation/useActivateRecipe";
import brickRegistry from "@/bricks/registry";

jest.mock("@/modDefinitions/modDefinitionHooks");

jest.mock("@/sidebar/sidebarSelectors");

const useRequiredModDefinitionsMock = jest.mocked(useRequiredModDefinitions);
const checkModDefinitionPermissionsMock = jest.mocked(
  checkModDefinitionPermissions,
);
const hideSidebarSpy = jest.spyOn(messengerApi, "hideSidebar");

jest.mock("@/starterBricks/starterBrickModUtils", () => {
  const actualUtils = jest.requireActual(
    "@/starterBricks/starterBrickModUtils",
  );

  return {
    __esModule: true,
    ...actualUtils,
    includesQuickBarStarterBrick: jest.fn(),
  };
});

const includesQuickBarMock = jest.mocked(includesQuickBarStarterBrick);

jest.mock("@/registry/internal", () => ({
  // We're also mocking all the functions that this output is passed to, so we can return empty array
  resolveRecipe: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/hooks/useQuickbarShortcut");

const useQuickbarShortcutMock = jest.mocked(useQuickbarShortcut);

jest.mock("@/activation/useActivateRecipe", () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(async () => ({ success: true })),
}));

const useActivateRecipeMock = jest.mocked(useActivateRecipe);
let activateRecipeSpy: jest.MockedFunction<
  (formValues: WizardValues, recipe: ModDefinition) => Promise<ActivateResult>
>;

beforeAll(() => {
  registerDefaultWidgets();
  // Wire up registry for integrated testing
  jest.mocked(services.refresh).mockImplementation(refreshServices);
  jest.mocked(registry.syncRemote).mockImplementation(syncPackages);
  jest.mocked(registry.find).mockImplementation(find);
  jest.mocked(registry.clear).mockImplementation(clear);

  activateRecipeSpy = jest.fn(async (formValues, recipeDefinition) => ({
    success: true,
  }));
});

beforeEach(() => {
  appApiMock.reset();
  hideSidebarSpy.mockReset();
  activateRecipeSpy.mockReset();

  activateRecipeSpy.mockResolvedValue({ success: true });

  useActivateRecipeMock.mockReturnValue(activateRecipeSpy);
  includesQuickBarMock.mockResolvedValue(false);

  useQuickbarShortcutMock.mockReturnValue({
    shortcut: null,
    isConfigured: false,
  });

  checkModDefinitionPermissionsMock.mockResolvedValue({
    hasPermissions: true,
    permissions: {},
  });
});

afterEach(async () => {
  await registry.clear();
  brickRegistry.clear();
  appApiMock.reset();
});

let modDefinition: ModDefinition;

function setupMocksAndRender(
  modDefinitionOverride?: Partial<ModDefinition>,
  {
    componentOverride,
  }: {
    componentOverride?: React.ReactElement;
  } = {},
) {
  modDefinition = defaultModDefinitionFactory({
    ...modDefinitionOverride,
    metadata: {
      id: validateRegistryId("test-mod"),
      name: "Test Mod",
    },
  });
  useRequiredModDefinitionsMock.mockReturnValue(
    valueToAsyncCacheState([modDefinition]),
  );
  const listing = marketplaceListingFactory({
    // Consistent user-visible name for snapshots
    package: modDefinitionToMarketplacePackage(modDefinition),
  });

  // Tests can override by calling before setupMocksAndRender
  appApiMock.onGet("/api/marketplace/listings/").reply(200, [listing]);
  appApiMock.onGet().reply(200, []);

  const entry = sidebarEntryFactory("activateMods", {
    modIds: [modDefinition.metadata.id],
    heading: "Activate Mod",
  });

  const element = componentOverride ?? (
    <ActivateModPanel
      mod={{ modId: modDefinition.metadata.id, initialOptions: {} }}
    />
  );

  return render(element, {
    setupRedux(dispatch) {
      dispatch(sidebarSlice.actions.showModActivationPanel(entry));
    },
  });
}

describe("ActivateModPanel", () => {
  it("renders with options, permissions info", async () => {
    jest.mocked(checkModDefinitionPermissions).mockResolvedValue({
      hasPermissions: false,
      permissions: { origins: ["https://newurl.com"] },
    });

    const { asFragment } = setupMocksAndRender({
      options: {
        schema: propertiesToSchema(
          {
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
          },
          ["foo", "bar", "testDatabase"],
        ),
      },
    });

    await waitForEffect();

    expect(asFragment()).toMatchSnapshot();
  });

  it("activates basic mod automatically and renders well-done page", async () => {
    const { asFragment } = setupMocksAndRender();

    await waitForEffect();

    expect(asFragment()).toMatchSnapshot();
  });

  it("activates basic mod with empty options structure automatically and renders well-done page", async () => {
    const { asFragment } = setupMocksAndRender({
      options: {
        schema: {},
      },
    });

    await waitForEffect();

    expect(asFragment()).toMatchSnapshot();
  });

  it("activates mod with database preview automatically and renders well-done page", async () => {
    const { asFragment } = setupMocksAndRender({
      options: {
        schema: propertiesToSchema(
          {
            testDatabase: {
              $ref: "https://app.pixiebrix.com/schemas/database#",
              title: "Database",
              format: "preview",
            },
          },
          ["testDatabase"],
        ),
      },
    });

    await waitForEffect();

    expect(asFragment()).toMatchSnapshot();
  });

  it("activates mod automatically with optional integration dependency and no auth options and renders well-done page", async () => {
    const { integrationDefinition } = generateIntegrationAndRemoteConfig();
    // Don't include a remote auth option
    appApiMock.onGet("/api/services/shared/").reply(200, []);
    appApiMock.onGet("/api/services/").reply(200, [integrationDefinition]);
    appApiMock
      .onGet("/api/registry/bricks/")
      .reply(200, [integrationDefinition]);

    await refreshRegistries();

    setupMocksAndRender({
      extensionPoints: [
        modComponentDefinitionFactory({
          services: {
            properties: {
              service1: {
                $ref: `${SERVICES_BASE_SCHEMA_URL}${integrationDefinition.metadata.id}`,
              },
            },
            required: [],
          },
        }),
      ],
    });

    expect(
      await screen.findByText("Well done", { exact: false }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Ok" })).toBeVisible();
    expect(activateRecipeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        integrationDependencies: expect.arrayContaining([
          expect.objectContaining({
            integrationId: integrationDefinition.metadata.id,
            // Should activate without configuring the optional integration
            configId: expect.toBeNil(),
          }),
        ]),
      }),
      expect.toBeObject(),
    );
  });

  it("activates mod automatically with required integration dependency and built-in auth option and renders well-done page", async () => {
    const { remoteConfig, integrationDefinition } =
      generateIntegrationAndRemoteConfig();
    appApiMock.onGet("/api/services/shared/").reply(200, [remoteConfig]);
    appApiMock.onGet("/api/services/").reply(200, [integrationDefinition]);
    appApiMock
      .onGet("/api/registry/bricks/")
      .reply(200, [integrationDefinition]);

    await refreshRegistries();

    setupMocksAndRender({
      extensionPoints: [
        modComponentDefinitionFactory({
          services: {
            properties: {
              service1: {
                $ref: `${SERVICES_BASE_SCHEMA_URL}${integrationDefinition.metadata.id}`,
              },
            },
            required: ["service1"],
          },
        }),
      ],
    });

    expect(
      await screen.findByText("Well done", { exact: false }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Ok" })).toBeVisible();
    expect(activateRecipeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        integrationDependencies: expect.arrayContaining([
          expect.objectContaining({
            integrationId: integrationDefinition.metadata.id,
            // Should activate with the built-in configuration
            configId: remoteConfig.id,
          }),
        ]),
      }),
      expect.toBeObject(),
    );
  });

  it("activates mod automatically with optional integration dependency and built-in auth option and renders well-done page", async () => {
    const { remoteConfig, integrationDefinition } =
      generateIntegrationAndRemoteConfig();
    // Include the remote auth option
    appApiMock.onGet("/api/services/shared/").reply(200, [remoteConfig]);
    appApiMock.onGet("/api/services/").reply(200, [integrationDefinition]);
    appApiMock
      .onGet("/api/registry/bricks/")
      .reply(200, [integrationDefinition]);

    await refreshRegistries();

    setupMocksAndRender({
      extensionPoints: [
        modComponentDefinitionFactory({
          services: {
            properties: {
              service1: {
                $ref: `${SERVICES_BASE_SCHEMA_URL}${integrationDefinition.metadata.id}`,
              },
            },
            required: [],
          },
        }),
      ],
    });

    expect(
      await screen.findByText("Well done", { exact: false }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Ok" })).toBeVisible();
    expect(activateRecipeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        integrationDependencies: expect.arrayContaining([
          expect.objectContaining({
            integrationId: integrationDefinition.metadata.id,
            // Should activate with the built-in configuration
            configId: remoteConfig.id,
          }),
        ]),
      }),
      expect.toBeObject(),
    );
  });

  it("does not activate mod automatically when required integration does not have built-in config available", async () => {
    const { integrationDefinition } = generateIntegrationAndRemoteConfig();
    // Don't include the remote auth option
    appApiMock.onGet("/api/services/shared/").reply(200, []);
    appApiMock.onGet("/api/services/").reply(200, [integrationDefinition]);
    appApiMock
      .onGet("/api/registry/bricks/")
      .reply(200, [integrationDefinition]);

    await refreshRegistries();

    setupMocksAndRender({
      extensionPoints: [
        modComponentDefinitionFactory({
          services: {
            properties: {
              service1: {
                $ref: `${SERVICES_BASE_SCHEMA_URL}${integrationDefinition.metadata.id}`,
              },
            },
            required: ["service1"],
          },
        }),
      ],
    });

    expect(
      await screen.findByText(
        "We're almost there. This mod has a few settings to configure before using.",
        { exact: false },
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Finish Activating" }),
    ).toBeVisible();
    expect(activateRecipeSpy).not.toHaveBeenCalled();
  });

  it("does not activate mod automatically when one integration is required and one is not", async () => {
    const { integrationDefinition: integrationDefinition1 } =
      generateIntegrationAndRemoteConfig();
    const { integrationDefinition: integrationDefinition2 } =
      generateIntegrationAndRemoteConfig();
    // Don't include the remote configs
    appApiMock.onGet("/api/services/shared/").reply(200, []);
    appApiMock
      .onGet("/api/services/")
      .reply(200, [integrationDefinition1, integrationDefinition2]);
    appApiMock
      .onGet("/api/registry/bricks/")
      .reply(200, [integrationDefinition1, integrationDefinition2]);

    await refreshRegistries();

    setupMocksAndRender({
      extensionPoints: [
        modComponentDefinitionFactory({
          services: {
            properties: {
              service1: {
                $ref: `${SERVICES_BASE_SCHEMA_URL}${integrationDefinition1.metadata.id}`,
              },
              service2: {
                $ref: `${SERVICES_BASE_SCHEMA_URL}${integrationDefinition2.metadata.id}`,
              },
            },
            required: ["service1"],
          },
        }),
      ],
    });

    expect(
      await screen.findByText(
        "We're almost there. This mod has a few settings to configure before using.",
        { exact: false },
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Finish Activating" }),
    ).toBeVisible();
    expect(activateRecipeSpy).not.toHaveBeenCalled();
  });

  it("does not activate mod automatically when one options is required", async () => {
    setupMocksAndRender({
      options: {
        schema: {
          description: "These are instructions",
          type: "object",
          properties: {
            foo: {
              type: "string",
            },
          },
          required: ["foo"],
        },
      },
    });

    await expect(
      screen.findByText("These are instructions"),
    ).resolves.toBeVisible();

    // Shows the custom instructions
    expect(
      screen.queryByText("We're almost there.", { exact: false }),
    ).toBeNull();

    expect(
      screen.getByRole("button", { name: "Finish Activating" }),
    ).toBeVisible();
  });

  it("renders well-done page for quick bar mod shortcut not configured", async () => {
    includesQuickBarMock.mockResolvedValue(true);

    const { asFragment } = setupMocksAndRender();

    await waitForEffect();

    expect(asFragment()).toMatchSnapshot();
  });

  it("renders well-done page for quick bar mod shortcut is configured on MacOS", async () => {
    includesQuickBarMock.mockResolvedValue(true);

    useQuickbarShortcutMock.mockReturnValue({
      shortcut: "⌘M",
      isConfigured: true,
    });

    const { asFragment } = setupMocksAndRender();

    await waitForEffect();

    expect(asFragment()).toMatchSnapshot();
  });

  it("renders well-done page for quick bar mod shortcut is configured on Windows", async () => {
    includesQuickBarMock.mockResolvedValue(true);

    useQuickbarShortcutMock.mockReturnValue({
      shortcut: "Ctrl+M",
      isConfigured: true,
    });

    const { asFragment } = setupMocksAndRender();

    await waitForEffect();

    expect(asFragment()).toMatchSnapshot();
  });

  it("doesn't flicker while built-in auths are loading", async () => {
    const { modDefinition } = getModDefinitionWithBuiltInIntegrationConfigs();

    onDeferredGet("/api/services/shared/");

    setupMocksAndRender(modDefinition);

    await waitForEffect();

    expect(screen.getByTestId("loader")).not.toBeNull();
  });
});

describe("ActivateMultipleModsPanel", () => {
  it("automatically activates single mod", async () => {
    const { modDefinition, builtInIntegrationConfigs } =
      getModDefinitionWithBuiltInIntegrationConfigs();

    appApiMock
      .onGet("/api/services/shared/")
      .reply(200, builtInIntegrationConfigs);

    const { asFragment } = setupMocksAndRender(modDefinition, {
      componentOverride: (
        <ActivateMultipleModsPanel
          mods={[{ modId: modDefinition.metadata.id, initialOptions: {} }]}
        />
      ),
    });

    await waitForEffect();

    expect(asFragment()).toMatchSnapshot();
  });

  it("shows error if any mod requires configuration", async () => {
    const { modDefinition } = getModDefinitionWithBuiltInIntegrationConfigs();

    setupMocksAndRender(modDefinition, {
      componentOverride: (
        <ErrorBoundary>
          <ActivateMultipleModsPanel
            mods={[{ modId: modDefinition.metadata.id, initialOptions: {} }]}
          />
        </ErrorBoundary>
      ),
    });

    await waitForEffect();

    expect(
      screen.getByText(
        "One or more mods require configuration. Activate the mods individually to configure them.",
      ),
    ).toBeInTheDocument();
  });
});
