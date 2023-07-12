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

import type { Me } from "@/types/contract";
import { maybeGetLinkedApiClient } from "@/services/apiClient";
import reportError from "@/telemetry/reportError";
import { loadOptions } from "@/store/extensionsStorage";
import type { IExtension, UnresolvedExtension } from "@/types/extensionTypes";
import type { RegistryId, SemVerString } from "@/types/registryTypes";
import type { ModDefinition } from "@/types/modDefinitionTypes";
import type { ExtensionOptionsState } from "@/store/extensionsTypes";
import { selectExtensionsForRecipe } from "@/store/extensionsSelectors";
import extensionsSlice from "@/store/extensionsSlice";

//const UPDATE_INTERVAL_MS = 10 * 60 * 1000;
const UPDATE_INTERVAL_MS = 60 * 1000;

// TODO: we should consider start extracting this request pattern into an api of some
//  kind that the background script can use
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

export function collectModVersions(
  mods: Array<IExtension["_recipe"]>
): Record<RegistryId, SemVerString> {
  const modVersions: Record<RegistryId, SemVerString> = {};

  for (const { id, version } of mods) {
    // eslint-disable-next-line security/detect-object-injection -- id is a registry id
    if (modVersions[id] && modVersions[id] !== version) {
      reportError(
        new Error(
          `Found two different mod versions activated for the same mod: ${id} (${modVersions[id]}, ${version}).`
        )
      );
    }

    // eslint-disable-next-line security/detect-object-injection -- id is a registry id
    modVersions[id] = version;
  }

  return modVersions;
}

export async function getActivatedMarketplaceModMetadata(): Promise<
  Array<IExtension["_recipe"]>
> {
  const { extensions: activatedModComponents } = await loadOptions();

  // Typically most Marketplace mods would not be a deployment. If this happens to be the case,
  // the deployment updater will handle the updates.
  return activatedModComponents
    .filter((mod) => mod._recipe?.sharing?.public && !mod._deployment)
    .map((mod) => mod._recipe);
  // TODO: maybe get rid of the _recipe part and just return the whole mod component 👆
}

export async function fetchModUpdates(
  activatedMods: Array<IExtension["_recipe"]>
) {
  const client = await maybeGetLinkedApiClient();
  if (client == null) {
    console.debug(
      "Skipping automatic mod updates because the extension is not linked to the PixieBrix service"
    );
    return {};
  }

  try {
    const {
      data: { updates },
    } = await client.post<{
      updates: Record<
        RegistryId,
        {
          backwards_compatible: ModDefinition;
          backwards_incompatible: boolean;
        }
      >;
    }>("/api/registry/updates/", {
      versions: collectModVersions(activatedMods),
    });

    console.log("*** updates", updates);

    return updates;
  } catch (error) {
    reportError(error);
    return {};
  }
}

function deactivateModComponent(
  modComponent: UnresolvedExtension,
  optionsState: ExtensionOptionsState
  // TODO: do we also need editorState?
  //  editorState: EditorState | undefined,
): ExtensionOptionsState {
  return extensionsSlice.reducer(
    optionsState,
    extensionsSlice.actions.removeExtension({ extensionId: modComponent.id })
  );
}

export function deactivateMod(
  modId: RegistryId,
  optionsState: ExtensionOptionsState
  // TODO: do we also need editorState?
  //  editorState: EditorState | undefined,
): {
  options: ExtensionOptionsState;
  deactivatedModComponents: UnresolvedExtension[];
} {
  console.log("*** uninstalling mod", modId);
  let options = optionsState;

  const activatedModComponentSelector = selectExtensionsForRecipe(modId);
  const activatedModComponents = activatedModComponentSelector({
    options: optionsState,
  });
  const deactivatedModComponents: UnresolvedExtension[] = [];

  for (const activatedModComponent of activatedModComponents) {
    options = deactivateModComponent(activatedModComponent, options);
    deactivatedModComponents.push(activatedModComponent);
  }

  return { options, deactivatedModComponents };
}

// TODO: implement me
// function activateMod(
//   mod: ModDefinition,
//   optionsState: ExtensionOptionsState,
// ): ExtensionOptionsState {
//   console.log("*** installing mod", mod);
//   let options = optionsState;
//
//   // TODO: implement me
//
//   return options;
// }

function updateActivatedMod(
  mod: ModDefinition,
  optionsState: ExtensionOptionsState
) {
  console.log("*** updating mod", mod);

  // Save all mod options/service configurations
  // Which is just grabbing the services and optionsArgs from the ActivatedModComponent
  console.log(
    "*** saving mod options/service configurations",
    mod,
    optionsState.extensions
  );

  // Uninstall the mod
  options = deactivateMod(mod.metadata.id, options);

  // Reinstall the mod with the updated mod definition
  // options = activateMod(mod, options);
}

async function updateActivatedMods(
  modUpdates: Record<
    RegistryId,
    { backwards_compatible: ModDefinition; backwards_incompatible: boolean }
  >
) {
  const optionsState = await loadOptions();
  console.log("*** activating mods");
  for (const { backwards_compatible } of Object.values(modUpdates)) {
    // Probably uninstall & call installRecipe from extensionsSlice?
    if (!backwards_compatible) {
      continue;
    }

    updateActivatedMod(backwards_compatible, optionsState);
  }
}

async function checkForModUpdates() {
  console.log("*** checking for mod updates");

  if (!(await autoModUpdatesEnabled())) {
    console.log("*** automatic mod updates disabled");
    return;
  }

  console.log("*** automatic mod updates enabled :)");

  const activatedMarketplaceMods = await getActivatedMarketplaceModMetadata();

  console.log("*** activatedMarketplaceMods", activatedMarketplaceMods);

  // Send this list to the registry/updates endpoint & get back the list of updates
  const modUpdates = await fetchModUpdates(activatedMarketplaceMods);

  // Use the list to update the mods
  await updateActivatedMods(modUpdates);
}

export async function initModUpdater(): Promise<void> {
  setInterval(checkForModUpdates, UPDATE_INTERVAL_MS);
  void checkForModUpdates();
}
