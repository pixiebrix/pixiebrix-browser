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

import extensionsSlice from "@/store/extensionsSlice";
import { maybeGetLinkedApiClient } from "@/services/apiClient";
import { loadOptions, saveOptions } from "@/store/extensionsStorage";
import { type ModDefinition } from "@/types/modDefinitionTypes";
import { forEachTab } from "@/background/activeTab";
import { queueReactivateTab } from "@/contentScript/messenger/api";
import { type ModComponentOptionsState } from "@/store/extensionsTypes";
import reportError from "@/telemetry/reportError";
import { debounce } from "lodash";
import { refreshRegistries } from "./refreshRegistries";
import { type RemoteIntegrationConfig } from "@/types/contract";
import { getSharingType } from "@/hooks/auth";
import { memoizeUntilSettled } from "@/utils/promiseUtils";
import { type IntegrationDependency } from "@/types/integrationTypes";
import { getUnconfiguredComponentIntegrations } from "@/utils/modDefinitionUtils";

const { reducer, actions } = extensionsSlice;

const PLAYGROUND_URL = "https://www.pixiebrix.com/welcome";
const MOD_INSTALLATION_DEBOUNCE_MS = 10_000;
const MOD_INSTALLATION_MAX_MS = 60_000;

export async function getBuiltInIntegrationConfigs(): Promise<
  RemoteIntegrationConfig[]
> {
  const client = await maybeGetLinkedApiClient();
  if (client == null) {
    return [];
  }

  try {
    const { data: integrationConfigs } = await client.get<
      RemoteIntegrationConfig[]
    >("/api/services/shared/?meta=1");

    return integrationConfigs.filter(
      (auth) => getSharingType(auth) === "built-in"
    );
  } catch (error) {
    reportError(error);
    return [];
  }
}

function installModInOptionsState(
  state: ModComponentOptionsState,
  blueprint: ModDefinition,
  configuredDependencies: IntegrationDependency[]
): ModComponentOptionsState {
  return reducer(
    state,
    actions.installMod({
      modDefinition: blueprint,
      configuredDependencies,
      screen: "starterMod",
      isReinstall: false,
    })
  );
}

async function installMods(modDefinitions: ModDefinition[]): Promise<boolean> {
  let installed = false;
  if (modDefinitions.length === 0) {
    return installed;
  }

  const unconfiguredIntegrationDependencies =
    getUnconfiguredComponentIntegrations({
      extensionPoints: modDefinitions.flatMap((mod) => mod.extensionPoints),
    });
  const builtInIntegrationConfigs = await getBuiltInIntegrationConfigs();
  const builtInDependencies = unconfiguredIntegrationDependencies.map(
    (unconfiguredDependency) => {
      const builtInConfig = builtInIntegrationConfigs.find(
        (config) =>
          config.service.config.metadata.id === unconfiguredDependency.id
      );

      if (!builtInConfig) {
        throw new Error(
          `No built-in config found for integration ${unconfiguredDependency.id}. Check that starter mods have built-in configuration options for all required integrations.`
        );
      }

      return {
        ...unconfiguredDependency,
        config: builtInConfig.id,
      };
    }
  );
  let optionsState = await loadOptions();

  for (const modDefinition of modDefinitions) {
    const modAlreadyInstalled = optionsState.extensions.some(
      (extension) => extension._recipe?.id === modDefinition.metadata.id
    );

    if (!modAlreadyInstalled) {
      optionsState = installModInOptionsState(
        optionsState,
        modDefinition,
        builtInDependencies
      );
      installed = true;
    }
  }

  await saveOptions(optionsState);
  await forEachTab(queueReactivateTab);
  return installed;
}

async function getStarterMods(): Promise<ModDefinition[]> {
  const client = await maybeGetLinkedApiClient();
  if (client == null) {
    console.debug(
      "Skipping starter blueprint installation because the extension is not linked to the PixieBrix service"
    );
    return [];
  }

  try {
    const { data: starterMods } = await client.get<ModDefinition[]>(
      "/api/onboarding/starter-blueprints/",
      { params: { ignore_user_state: true } }
    );
    return starterMods;
  } catch (error) {
    reportError(error);
    return [];
  }
}

/**
 * Installs starter mods and refreshes local registries from remote.
 * @returns true if any of the starter mods were installed
 */
const _installStarterMods = async (): Promise<boolean> => {
  const starterMods = await getStarterMods();

  try {
    // Installing Starter Blueprints and pulling the updates from remote registries to make sure
    // that all the bricks used in starter blueprints are available
    const [installed] = await Promise.all([
      installMods(starterMods),
      refreshRegistries(),
    ]);

    return installed;
  } catch (error) {
    reportError(error);
    return false;
  }
};

export const debouncedInstallStarterMods = debounce(
  memoizeUntilSettled(_installStarterMods),
  MOD_INSTALLATION_DEBOUNCE_MS,
  {
    leading: true,
    trailing: false,
    maxWait: MOD_INSTALLATION_MAX_MS,
  }
);

function initStarterMods(): void {
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab?.url?.startsWith(PLAYGROUND_URL)) {
      void debouncedInstallStarterMods();
    }
  });
}

export default initStarterMods;
