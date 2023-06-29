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

import { type Deployment, type Me } from "@/types/contract";
import { isEmpty, partition } from "lodash";
import reportError from "@/telemetry/reportError";
import { getUID } from "@/background/messenger/api";
import { getExtensionVersion } from "@/chrome";
import { isLinked, readAuthData, updateUserData } from "@/auth/token";
import { reportEvent } from "@/telemetry/events";
import { refreshRegistries } from "@/hooks/useRefreshRegistries";
import {
  selectExtensions,
  selectExtensionsForRecipe,
} from "@/store/extensionsSelectors";
import { maybeGetLinkedApiClient } from "@/services/apiClient";
import { queueReactivateTab } from "@/contentScript/messenger/api";
import { forEachTab } from "@/background/activeTab";
import { parse as parseSemVer, satisfies, type SemVer } from "semver";
import { type ExtensionOptionsState } from "@/store/extensionsTypes";
import extensionsSlice from "@/store/extensionsSlice";
import { loadOptions, saveOptions } from "@/store/extensionsStorage";
import { expectContext } from "@/utils/expectContext";
import { getSettingsState, saveSettingsState } from "@/store/settingsStorage";
import { isUpdateAvailable } from "@/background/installer";
import { selectUserDataUpdate } from "@/auth/authUtils";
import {
  findLocalDeploymentServiceConfigurations,
  makeUpdatedFilter,
  mergeDeploymentServiceConfigurations,
  selectInstalledDeployments,
} from "@/utils/deploymentUtils";
import { selectUpdatePromptState } from "@/store/settingsSelectors";
import settingsSlice from "@/store/settingsSlice";
import { locator } from "@/background/locator";
import { getEditorState, saveEditorState } from "@/store/dynamicElementStorage";
import { type EditorState } from "@/pageEditor/pageEditorTypes";
import { editorSlice } from "@/pageEditor/slices/editorSlice";
import { removeExtensionForEveryTab } from "@/background/removeExtensionForEveryTab";
import registerBuiltinBlocks from "@/blocks/registerBuiltinBlocks";
import registerContribBlocks from "@/contrib/registerContribBlocks";
import { launchSsoFlow } from "@/store/enterprise/singleSignOn";
import { readManagedStorage } from "@/store/enterprise/managedStorage";
import { type UUID } from "@/types/stringTypes";
import { type UnresolvedExtension } from "@/types/extensionTypes";
import { type RegistryId } from "@/types/registryTypes";
import { type OptionsArgs } from "@/types/runtimeTypes";
import { checkDeploymentPermissions } from "@/permissions/deploymentPermissionsHelpers";

const { reducer: optionsReducer, actions: optionsActions } = extensionsSlice;
const { reducer: editorReducer, actions: editorActions } = editorSlice;
const locateAllForService = locator.locateAllForService.bind(locator);

const UPDATE_INTERVAL_MS = 5 * 60 * 1000;

async function setExtensionsState(state: ExtensionOptionsState): Promise<void> {
  await saveOptions(state);
  await forEachTab(queueReactivateTab);
}

function uninstallExtensionFromStates(
  optionsState: ExtensionOptionsState,
  editorState: EditorState | undefined,
  extensionId: UUID
): {
  options: ExtensionOptionsState;
  editor: EditorState;
} {
  const options = optionsReducer(
    optionsState,
    optionsActions.removeExtension({ extensionId })
  );
  const editor = editorState
    ? editorReducer(editorState, editorActions.removeElement(extensionId))
    : undefined;
  return { options, editor };
}

async function uninstallExtensionsAndSaveState(
  toUninstall: UnresolvedExtension[],
  {
    editorState,
    optionsState,
  }: { editorState: EditorState; optionsState: ExtensionOptionsState }
): Promise<void> {
  // Uninstall existing versions of the extensions
  for (const extension of toUninstall) {
    const result = uninstallExtensionFromStates(
      optionsState,
      editorState,
      extension.id
    );
    optionsState = result.options;
    editorState = result.editor;
  }

  await Promise.allSettled(
    toUninstall.map(async ({ id }) => removeExtensionForEveryTab(id))
  );

  await setExtensionsState(optionsState);
  await saveEditorState(editorState);
}

/**
 * Uninstall all deployments by uninstalling all extensions associated with a deployment.
 */
export async function uninstallAllDeployments(): Promise<void> {
  const [optionsState, editorState] = await Promise.all([
    loadOptions(),
    getEditorState(),
  ]);
  const installed = selectExtensions({ options: optionsState });

  const toUninstall = installed.filter(
    (extension) => !isEmpty(extension._deployment)
  );

  if (toUninstall.length === 0) {
    // Short-circuit to skip reporting telemetry
    return;
  }

  await uninstallExtensionsAndSaveState(toUninstall, {
    editorState,
    optionsState,
  });

  reportEvent("DeploymentDeactivateAll", {
    auto: true,
    deployments: toUninstall.map((x) => x._deployment.id),
  });
}

async function uninstallUnmatchedDeployments(
  deployments: Deployment[]
): Promise<void> {
  const [optionsState, editorState] = await Promise.all([
    loadOptions(),
    getEditorState(),
  ]);
  const installed = selectExtensions({ options: optionsState });

  const deploymentRecipeIds = new Set(
    deployments.map((deployment) => deployment.package.package_id)
  );

  const toUninstall = installed.filter(
    (extension) =>
      !isEmpty(extension._deployment) &&
      !deploymentRecipeIds.has(extension._recipe?.id)
  );

  if (toUninstall.length === 0) {
    // Short-circuit to skip reporting telemetry
    return;
  }

  await uninstallExtensionsAndSaveState(toUninstall, {
    editorState,
    optionsState,
  });

  reportEvent("DeploymentDeactivateUnassigned", {
    auto: true,
    deployments: toUninstall.map((x) => x._deployment.id),
  });
}

async function uninstallRecipe(
  optionsState: ExtensionOptionsState,
  editorState: EditorState | undefined,
  recipeId: RegistryId
): Promise<{
  options: ExtensionOptionsState;
  editor: EditorState | undefined;
}> {
  let options = optionsState;
  let editor = editorState;

  const recipeOptionsSelector = selectExtensionsForRecipe(recipeId);
  const recipeExtensions = recipeOptionsSelector({ options: optionsState });

  // Uninstall existing versions of the extensions
  for (const extension of recipeExtensions) {
    const result = uninstallExtensionFromStates(options, editor, extension.id);
    options = result.options;
    editor = result.editor;
  }

  return { options, editor };
}

async function installDeployment(
  optionsState: ExtensionOptionsState,
  editorState: EditorState | undefined,
  deployment: Deployment
): Promise<{
  options: ExtensionOptionsState;
  editor: EditorState | undefined;
}> {
  let options = optionsState;
  let editor = editorState;

  // Uninstall existing versions of the extensions
  const result = await uninstallRecipe(
    options,
    editor,
    deployment.package.package_id
  );

  options = result.options;
  editor = result.editor;

  // Install the deployment's blueprint with the service definition
  options = optionsReducer(
    options,
    optionsActions.installRecipe({
      recipe: deployment.package.config,
      extensionPoints: deployment.package.config.extensionPoints,
      deployment,
      services: await mergeDeploymentServiceConfigurations(
        deployment,
        locateAllForService
      ),
      // Assume backend properly validates the options
      optionsArgs: deployment.options_config as OptionsArgs,
    })
  );

  reportEvent("DeploymentActivate", {
    deployment: deployment.id,
    auto: true,
  });

  return { options, editor };
}

/**
 * Install all deployments
 * @param deployments deployments that PixieBrix already has permission to run
 */
async function installDeployments(deployments: Deployment[]): Promise<void> {
  let [optionsState, editorState] = await Promise.all([
    loadOptions(),
    getEditorState(),
  ]);

  for (const deployment of deployments) {
    // eslint-disable-next-line no-await-in-loop -- running reducer, need to update states serially
    const result = await installDeployment(
      optionsState,
      editorState,
      deployment
    );
    optionsState = result.options;
    editorState = result.editor;
  }

  await setExtensionsState(optionsState);
  await saveEditorState(editorState);
}

type DeploymentConstraint = {
  deployment: Deployment;
  hasPermissions: boolean;
  extensionVersion: SemVer;
};

/**
 * Return true if the deployment can be automatically installed.
 *
 * For automatic install, the following must be true:
 * 1. PixieBrix already has permissions for the required pages/APIs
 * 2. The user has a version of the PixieBrix browser extension compatible with the deployment
 * 3. The user has exactly one (1) personal configuration for each unbound service for the deployment
 */
async function canAutomaticallyInstall({
  deployment,
  hasPermissions,
  extensionVersion,
}: DeploymentConstraint): Promise<boolean> {
  if (!hasPermissions) {
    return false;
  }

  const requiredRange = deployment.package.config.metadata.extensionVersion;
  if (requiredRange && !satisfies(extensionVersion, requiredRange)) {
    return false;
  }

  const personalServices = await findLocalDeploymentServiceConfigurations(
    deployment,
    locateAllForService
  );
  return Object.values(personalServices).every((x) => x.length === 1);
}

/**
 * Return the deployments that need to be installed because they have an update
 * @param deployments the deployments
 * @param restricted `true` if the user is a restricted user, e.g., as opposed to a developer
 */
async function selectUpdatedDeployments(
  deployments: Deployment[],
  { restricted }: { restricted: boolean }
): Promise<Deployment[]> {
  // Always get the freshest options slice from the local storage
  const { extensions } = await loadOptions();
  const updatePredicate = makeUpdatedFilter(extensions, { restricted });
  return deployments.filter((deployment) => updatePredicate(deployment));
}

async function markAllAsInstalled() {
  const settings = await getSettingsState();
  const next = settingsSlice.reducer(
    settings,
    settingsSlice.actions.resetUpdatePromptTimestamp()
  );
  await saveSettingsState(next);
}

/**
 * Sync local deployments with provisioned deployments.
 *
 * If PixieBrix does not have the permissions required to automatically activate a deployment, opens the Options page
 * so the user can click to activate the deployments.
 *
 * NOTE: if updates are snoozed, does not install updates automatically. (To not interrupt the current business
 * process the team member is working on.)
 */
export async function updateDeployments(): Promise<void> {
  expectContext("background");

  const now = Date.now();

  const [linked, { organizationId }, settings, managedStorage] =
    await Promise.all([
      isLinked(),
      readAuthData(),
      getSettingsState(),
      readManagedStorage(),
    ]);

  const { campaignIds = [], managedOrganizationId, ssoUrl } = managedStorage;

  if (!linked) {
    // If the Browser extension is unlinked (it doesn't have the API key), one of the following must be true:
    // - The user has managed install, and they have not linked their extension yet
    // - The user is part of an organization, and somehow lost their token: 1) the token is no longer valid
    //   so PixieBrix cleared it out, 2) something removed the local storage entry
    // - If the user is not an enterprise user (or has not linked their extension yet), just NOP. They likely they just
    //   need to reconnect their extension. If it's a non-enterprise user, they shouldn't have any deployments
    //   installed anyway.

    if (ssoUrl != null) {
      reportEvent("OrganizationExtensionLink", {
        organizationId,
        managedOrganizationId,
        // Initial marks whether this is the initial background deployment install
        initial: !organizationId,
        campaignIds,
        sso: true,
      });

      void launchSsoFlow(ssoUrl);

      return;
    }

    if (managedOrganizationId != null || organizationId != null) {
      reportEvent("OrganizationExtensionLink", {
        organizationId,
        managedOrganizationId,
        // Initial marks whether this is the initial background deployment install
        initial: !organizationId,
        campaignIds,
        sso: false,
      });

      void browser.runtime.openOptionsPage();

      return;
    }

    return;
  }

  if (organizationId == null) {
    // One of the three scenarios hold:
    // 1) has never been a member of an organization,
    // 2) has left their organization,
    // 3) linked their extension to a non-organization profile
    await uninstallAllDeployments();
    return;
  }

  // Always get the freshest options slice from the local storage
  const { extensions } = await loadOptions();

  // Version to report to the server. The update check happens via isUpdateAvailable below
  const { version: extensionVersionString } = browser.runtime.getManifest();
  const extensionVersion = parseSemVer(extensionVersionString);

  // This is the "heartbeat". The old behavior was to only send if the user had at least one deployment installed.
  // Now we're always sending in order to help team admins understand any gaps between number of registered users
  // and amount of activity when using deployments
  const client = await maybeGetLinkedApiClient();
  if (client == null) {
    console.debug(
      "Skipping deployments update because the extension is not linked to the PixieBrix service"
    );
    return;
  }

  const { data: profile, status: profileResponseStatus } = await client.get<Me>(
    "/api/me/"
  );

  const { isSnoozed, isUpdateOverdue, updatePromptTimestamp } =
    selectUpdatePromptState(
      { settings },
      {
        now,
        enforceUpdateMillis: profile.enforce_update_millis,
      }
    );

  if (profileResponseStatus >= 400) {
    // If our server is acting up, check again later
    console.debug(
      "Skipping deployments update because /api/me/ request failed"
    );

    return;
  }

  // Ensure the user's flags and telemetry information is up-to-date
  void updateUserData(selectUserDataUpdate(profile));

  const { data: deployments, status: deploymentResponseStatus } =
    await client.post<Deployment[]>("/api/deployments/", {
      uid: await getUID(),
      version: getExtensionVersion(),
      active: selectInstalledDeployments(extensions),
      campaignIds,
    });

  if (deploymentResponseStatus >= 400) {
    // Our server is active up, check again later
    console.debug(
      "Skipping deployments update because /api/deployments/ request failed"
    );
    return;
  }

  // Always uninstall unmatched deployments
  await uninstallUnmatchedDeployments(deployments);

  // Using the restricted-uninstall flag as a proxy for whether the user is a restricted user. The flag currently
  // corresponds to whether the user is a restricted user vs. developer
  const updatedDeployments = await selectUpdatedDeployments(deployments, {
    restricted: profile.flags.includes("restricted-uninstall"),
  });

  if (
    isSnoozed &&
    profile.enforce_update_millis &&
    updatePromptTimestamp == null &&
    (isUpdateAvailable() || updatedDeployments.length > 0)
  ) {
    // There are updates, so inform the user even though they have snoozed updates because there will be a countdown
    void browser.runtime.openOptionsPage();
    return;
  }

  if (isSnoozed && !isUpdateOverdue) {
    console.debug("Skipping deployments update because updates are snoozed");
    return;
  }

  if (
    isUpdateAvailable() &&
    // `restricted-version` is an implicit flag from the MeSerializer
    (profile.flags.includes("restricted-version") ||
      profile.enforce_update_millis)
  ) {
    console.info("Extension update available from the web store");
    // Have the user update their browser extension. (Since the new version might impact the deployment activation)
    void browser.runtime.openOptionsPage();
    return;
  }

  if (updatedDeployments.length === 0) {
    console.debug("No deployment updates found");
    return;
  }

  // Fetch the current brick definitions, which will have the current permissions and extensionVersion requirements
  try {
    await refreshRegistries();
  } catch (error) {
    reportError(error);
    void browser.runtime.openOptionsPage();
    // Bail and open the main options page, which 1) fetches the latest bricks, and 2) will prompt the user to
    // manually install the deployments via the banner
    return;
  }

  const deploymentRequirements = await Promise.all(
    updatedDeployments.map(async (deployment) => ({
      deployment,
      ...(await checkDeploymentPermissions(deployment, locateAllForService)),
    }))
  );

  const installability = await Promise.all(
    deploymentRequirements.map(async (requirement) => ({
      deployment: requirement.deployment,
      isAutomatic: await canAutomaticallyInstall({
        ...requirement,
        extensionVersion,
      }),
    }))
  );

  const [automatic, manual] = partition(installability, (x) => x.isAutomatic);

  let automaticError: boolean;

  if (automatic.length > 0) {
    try {
      await installDeployments(automatic.map((x) => x.deployment));
    } catch (error) {
      reportError(error);
      automaticError = true;
    }
  }

  if (manual.length === 0) {
    void markAllAsInstalled();
  }

  // We only want to call openOptionsPage a single time
  if (manual.length > 0 || automaticError) {
    void browser.runtime.openOptionsPage();
  }
}

/**
 * Reset the update countdown timer on startup.
 *
 * - If there was a Browser Extension update, it would have been applied
 * - We don't currently separately track timestamps for showing an update modal for deployments vs. browser extension
 * upgrades. However, in enterprise scenarios where enforceUpdateMillis is set, the IT policy is generally such
 * that IT can't reset the extension.
 */
async function resetUpdatePromptTimestamp() {
  // There could be a race here, but unlikely because this is run on startup
  console.debug("Resetting updatePromptTimestamp");
  const settings = await getSettingsState();
  await saveSettingsState({
    ...settings,
    updatePromptTimestamp: null,
  });
}

function initDeploymentUpdater(): void {
  // Need to load the built-in bricks for permissions checks to work on initial startup
  registerBuiltinBlocks();
  registerContribBlocks();

  setInterval(updateDeployments, UPDATE_INTERVAL_MS);
  void resetUpdatePromptTimestamp();
  void updateDeployments();
}

export default initDeploymentUpdater;
