/*
 * Copyright (C) 2022 PixieBrix, Inc.
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
import { RecipeDefinition } from "@/types/definitions";
import { forEachTab } from "@/background/util";
import { queueReactivateTab } from "@/contentScript/messenger/api";
import { ExtensionOptionsState } from "@/store/extensionsTypes";
import reportError from "@/telemetry/reportError";
import { debounce } from "lodash";

const { reducer, actions } = extensionsSlice;

const PLAYGROUND_URL = "https://www.pixiebrix.com/playground";
let isInstallingBlueprints = false;
const BLUEPRINT_INSTALLATION_DEBOUNCE_MS = 10_000;
const BLUEPRINT_INSTALLATION_MAX_MS = 60_000;

function installBlueprint(
  state: ExtensionOptionsState,
  blueprint: RecipeDefinition
): ExtensionOptionsState {
  return reducer(
    state,
    actions.installRecipe({
      recipe: blueprint,
      extensionPoints: blueprint.extensionPoints,
    })
  );
}

async function installBlueprints(
  blueprints: RecipeDefinition[]
): Promise<boolean> {
  let installed = false;
  if (blueprints.length === 0) {
    return installed;
  }

  let extensionsState = await loadOptions();
  for (const blueprint of blueprints) {
    const blueprintAlreadyInstalled = extensionsState.extensions.some(
      (extension) => extension._recipe.id === blueprint.metadata.id
    );

    if (!blueprintAlreadyInstalled) {
      extensionsState = installBlueprint(extensionsState, blueprint);
      installed = true;
    }
  }

  await saveOptions(extensionsState);
  await forEachTab(queueReactivateTab);
  return installed;
}

async function getShouldFirstTimeInstall(): Promise<boolean> {
  const client = await maybeGetLinkedApiClient();
  if (client == null) {
    console.debug(
      "Skipping starter blueprint installation because the extension is not linked to the PixieBrix service"
    );
    return false;
  }

  try {
    const {
      data: { install_starter_blueprints: shouldInstall },
    } = await client.get("/api/onboarding/starter-blueprints/install/");

    if (shouldInstall) {
      // If the starter blueprint request fails for some reason, or the user's primary organization
      // gets removed, we'd still like to mark starter blueprints as installed for this user
      // so that they don't see onboarding views/randomly have starter blueprints installed
      // the next time they open the extension
      await client.post("/api/onboarding/starter-blueprints/install/");
    }

    return shouldInstall;
  } catch (error) {
    reportError(error);
    return false;
  }
}

async function getStarterBlueprints(): Promise<RecipeDefinition[]> {
  const client = await maybeGetLinkedApiClient();
  if (client == null) {
    console.debug(
      "Skipping starter blueprint installation because the extension is not linked to the PixieBrix service"
    );
    return [];
  }

  try {
    const { data: starterBlueprints } = await client.get<RecipeDefinition[]>(
      "/api/onboarding/starter-blueprints/"
    );
    return starterBlueprints;
  } catch (error) {
    reportError(error);
    return [];
  }
}

const _installStarterBlueprints = async (): Promise<boolean> => {
  if (isInstallingBlueprints) {
    return false;
  }

  isInstallingBlueprints = true;
  const starterBlueprints = await getStarterBlueprints();
  const installed = await installBlueprints(starterBlueprints);
  isInstallingBlueprints = false;
  return installed;
};

const debouncedInstallStarterBlueprints = debounce(
  _installStarterBlueprints,
  BLUEPRINT_INSTALLATION_DEBOUNCE_MS,
  {
    leading: true,
    trailing: false,
    maxWait: BLUEPRINT_INSTALLATION_MAX_MS,
  }
);

export async function firstTimeInstallStarterBlueprints(): Promise<void> {
  const shouldInstall = await getShouldFirstTimeInstall();
  if (!shouldInstall) {
    return;
  }

  const installed = await debouncedInstallStarterBlueprints();

  if (installed) {
    void browser.tabs.create({
      url: PLAYGROUND_URL,
    });
  }
}

function initStarterBlueprints(): void {
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab?.url?.startsWith(PLAYGROUND_URL)) {
      void debouncedInstallStarterBlueprints();
    }
  });

  void firstTimeInstallStarterBlueprints();
}

export default initStarterBlueprints;
