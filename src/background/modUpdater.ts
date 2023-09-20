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

import type { Me, PackageVersionUpdates } from "@/types/contract";
import { maybeGetLinkedApiClient } from "@/services/apiClient";
import reportError from "@/telemetry/reportError";
import {
  getModComponentState,
  saveModComponentState,
} from "@/store/extensionsStorage";
import type { RegistryId, SemVerString } from "@/types/registryTypes";
import type { ModDefinition } from "@/types/modDefinitionTypes";
import { selectExtensionsForRecipe } from "@/store/extensionsSelectors";
import extensionsSlice from "@/store/extensionsSlice";
import { groupBy, isEmpty, uniq } from "lodash";
import { forEachTab } from "@/background/activeTab";
import { queueReactivateTab } from "@/contentScript/messenger/api";
import { getEditorState, saveEditorState } from "@/store/editorStorage";
import type { EditorState } from "@/pageEditor/pageEditorTypes";
import { editorSlice } from "@/pageEditor/slices/editorSlice";
import type {
  ActivatedModComponent,
  UnresolvedModComponent,
} from "@/types/modComponentTypes";
import {
  inferConfiguredModIntegrations,
  inferRecipeOptions,
} from "@/store/extensionsUtils";
import type { ModComponentState } from "@/store/extensionsTypes";
import { uninstallContextMenu } from "@/background/contextMenus";

const UPDATE_INTERVAL_MS = 10 * 60 * 1000;

type ActivatedModState = {
  options: ModComponentState;
  editor: EditorState;
};

type BackwardsCompatibleUpdate = {
  name: RegistryId;
  backwards_compatible: ModDefinition;
};

type PackageVersionPair = { name: RegistryId; version: SemVerString };

export async function autoModUpdatesEnabled(): Promise<boolean> {
  const client = await maybeGetLinkedApiClient();
  if (client == null) {
    console.debug(
      "Skipping automatic mod updates because the extension is not linked to the PixieBrix service"
    );
    return false;
  }

  try {
    const { data: profile } = await client.get<Me>("/api/me/");

    return profile.flags.includes("automatic-mod-updates");
  } catch (error) {
    console.debug(
      "Skipping automatic mod updates because /api/me/ request failed"
    );
    reportError(error);
    return false;
  }
}

/**
 * Produces an array of activated Marketplace mods by registry id and currently activated versions. For use
 * with the payload of the `api/registry/updates` endpoint.
 * @returns a unique list of mod registry ids and their versions
 */
export async function getActivatedMarketplaceModVersions(): Promise<
  PackageVersionPair[]
> {
  const { extensions: activatedModComponents } = await getModComponentState();

  // Typically most Marketplace mods would not be a deployment. If this happens to be the case,
  // the deployment updater will handle the updates.
  const mods: Array<ActivatedModComponent["_recipe"]> = activatedModComponents
    .filter((mod) => mod._recipe?.sharing?.public && !mod._deployment)
    .map((mod) => mod._recipe);

  const modVersions: PackageVersionPair[] = [];

  for (const [name, modComponents] of Object.entries(
    groupBy(mods, "id")
  ) as Array<[RegistryId, Array<ActivatedModComponent["_recipe"]>]>) {
    const uniqueModVersions: SemVerString[] = uniq(
      modComponents.map((modComponent) => modComponent.version)
    );

    if (uniqueModVersions.length > 1) {
      reportError(
        new Error(
          `Found multiple mod component versions activated for the same mod: ${name} (${uniqueModVersions.join(
            ", "
          )})`
        )
      );
    }

    modVersions.push({ name, version: uniqueModVersions[0] });
  }

  return modVersions;
}

/**
 * Fetches information about backwards compatible "force updates" for Marketplace mods that are currently activated.
 * @returns a list of mods with backwards compatible updates
 */
export async function fetchModUpdates(): Promise<BackwardsCompatibleUpdate[]> {
  const client = await maybeGetLinkedApiClient();
  if (client == null) {
    console.debug(
      "Skipping automatic mod updates because the extension is not linked to the PixieBrix service"
    );
    return [];
  }

  const modVersions = await getActivatedMarketplaceModVersions();

  if (isEmpty(modVersions)) {
    return [];
  }

  try {
    const {
      data: { updates },
    } = await client.post<PackageVersionUpdates>("/api/registry/updates/", {
      versions: modVersions,
    });

    // Only return backwards compatible updates for now. Future work outlines
    // handling backwards incompatible updates as well.
    return updates
      .filter(({ backwards_compatible }) => backwards_compatible)
      .map(({ name, backwards_compatible }) => ({
        name,
        backwards_compatible,
      }));
  } catch (error) {
    reportError(error);
    return [];
  }
}

/**
 * Deactivates the mod component from the extensions and editor redux stores. Note that while the mod component
 * is removed from redux, it is not removed from existing tabs until a navigation is triggered/store is refreshed in the respective tab.
 * This is to prevent interrupting the user's workflow when performing updates in the background.
 * @param modComponent the mod component to deactivate
 * @param reduxState the current state of the extension and editor redux stores
 * @returns the new redux state with the mod component deactivated
 */
function deactivateModComponent(
  modComponent: UnresolvedModComponent,
  reduxState: ActivatedModState
): ActivatedModState {
  let { options: newOptionsState, editor: newEditorState } = reduxState;

  newOptionsState = extensionsSlice.reducer(
    newOptionsState,
    extensionsSlice.actions.removeExtension({ extensionId: modComponent.id })
  );

  newEditorState = editorSlice.reducer(
    newEditorState,
    editorSlice.actions.removeElement(modComponent.id)
  );

  return {
    options: newOptionsState,
    editor: newEditorState,
  };
}

/**
 * Deactivates all mod components with the given mod id. Does not remove the mod UI from existing tabs.
 *
 * @param modId the mod registry id
 * @param reduxState the current state of the extension and editor redux stores
 * @returns {reduxState, deactivatedModComponents} new redux state with the mod components deactivated
 * and the mod components that were deactivated
 */
export function deactivateMod(
  modId: RegistryId,
  reduxState: ActivatedModState
): {
  reduxState: ActivatedModState;
  deactivatedModComponents: UnresolvedModComponent[];
} {
  let { options: newOptionsState, editor: newEditorState } = reduxState;

  const activatedModComponentSelector = selectExtensionsForRecipe(modId);
  const activatedModComponents = activatedModComponentSelector({
    options: newOptionsState,
  });

  const deactivatedModComponents: UnresolvedModComponent[] = [];
  for (const activatedModComponent of activatedModComponents) {
    const { options: nextOptionsState, editor: nextEditorState } =
      deactivateModComponent(activatedModComponent, {
        options: newOptionsState,
        editor: newEditorState,
      });
    newOptionsState = nextOptionsState;
    newEditorState = nextEditorState;

    deactivatedModComponents.push(activatedModComponent);

    // Remove the menu item UI from all mods. We must explicitly remove context menu items because otherwise the user
    // will see duplicate menu items because the old/new mod components have different UUIDs.
    // `updateMods` calls `queueReactivateTab`. Therefore, if the user clicks on a tab where the new version of the mod
    // component is not loaded yet, they'll get a notification to reload the page.
    void uninstallContextMenu({ extensionId: activatedModComponent.id });
  }

  return {
    reduxState: { options: newOptionsState, editor: newEditorState },
    deactivatedModComponents,
  };
}

/**
 * Update the mod by deactivating and reactivating the mod with all the same configurations.
 **
 * We currently don't have a way to "update" activated mods directly in the extension and editor redux stores.
 *
 * The ModComponents will have new UUIDs.
 *
 * @param modDefinition the mod to update
 * @param reduxState the current state of the extension and editor redux stores
 * @returns new redux state with the mod updated
 */
function updateMod(
  modDefinition: ModDefinition,
  reduxState: ActivatedModState
): ActivatedModState {
  let { options: newOptionsState, editor: newEditorState } = reduxState;

  const {
    reduxState: { options: nextOptionsState, editor: nextEditorState },
    deactivatedModComponents,
  } = deactivateMod(modDefinition.metadata.id, {
    options: newOptionsState,
    editor: newEditorState,
  });
  newOptionsState = nextOptionsState;
  newEditorState = nextEditorState;

  const configuredDependencies = inferConfiguredModIntegrations(
    deactivatedModComponents.filter(
      ({ integrationDependencies }) => integrationDependencies
    )
  );

  const optionsArgs = inferRecipeOptions(
    deactivatedModComponents.filter((modComponent) => modComponent.optionsArgs)
  );

  newOptionsState = extensionsSlice.reducer(
    newOptionsState,
    extensionsSlice.actions.installMod({
      modDefinition,
      configuredDependencies,
      optionsArgs,
      screen: "background",
      isReinstall: true,
    })
  );

  return {
    options: newOptionsState,
    editor: newEditorState,
  };
}

async function updateMods(modUpdates: BackwardsCompatibleUpdate[]) {
  let newOptionsState = await getModComponentState();
  let newEditorState = await getEditorState();

  for (const { backwards_compatible: update } of modUpdates) {
    const { options, editor } = updateMod(update, {
      options: newOptionsState,
      editor: newEditorState,
    });
    newOptionsState = options;
    newEditorState = editor;
  }

  await Promise.all([
    saveModComponentState(newOptionsState),
    saveEditorState(newEditorState),
  ]);

  await forEachTab(queueReactivateTab);
}

export async function updateModsIfForceUpdatesAvailable() {
  if (!(await autoModUpdatesEnabled())) {
    return;
  }

  const backwardsCompatibleModUpdates = await fetchModUpdates();

  if (isEmpty(backwardsCompatibleModUpdates)) {
    console.debug("No automatic mod updates found");
    return;
  }

  await updateMods(backwardsCompatibleModUpdates);
}

export function initModUpdater(): void {
  setInterval(updateModsIfForceUpdatesAvailable, UPDATE_INTERVAL_MS);
  void updateModsIfForceUpdatesAvailable();
}
