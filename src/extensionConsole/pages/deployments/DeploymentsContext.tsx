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

import { type Deployment } from "@/types/contract";
import React, { useCallback, useMemo } from "react";
import {
  ensurePermissionsFromUserGesture,
  mergePermissionsStatuses,
} from "@/permissions/permissionsUtils";
import { useDispatch, useSelector } from "react-redux";
import reportEvent from "@/telemetry/reportEvent";
import { Events } from "@/telemetry/events";
import { selectExtensions } from "@/store/extensionsSelectors";
import notify from "@/utils/notify";
import { getUID, services } from "@/background/messenger/api";
import { refreshRegistries } from "@/hooks/useRefreshRegistries";
import { type Dispatch } from "redux";
import { type ModComponentBase } from "@/types/modComponentTypes";
import { maybeGetLinkedApiClient } from "@/services/apiClient";
import extensionsSlice from "@/store/extensionsSlice";
import useFlags from "@/hooks/useFlags";
import {
  checkExtensionUpdateRequired,
  makeUpdatedFilter,
  mergeDeploymentServiceConfigurations,
  selectInstalledDeployments,
} from "@/utils/deploymentUtils";
import settingsSlice from "@/store/settingsSlice";
import { checkDeploymentPermissions } from "@/permissions/deploymentPermissionsHelpers";
import useAsyncState from "@/hooks/useAsyncState";

import { logPromiseDuration } from "@/utils/promiseUtils";

import {
  getExtensionVersion,
  reloadIfNewVersionIsReady,
} from "@/utils/extensionUtils";

const { actions } = extensionsSlice;

/**
 * Fetch deployments, or return empty array if the extension is not linked to the PixieBrix API.
 */
async function fetchDeployments(
  installedExtensions: ModComponentBase[]
): Promise<Deployment[]> {
  const client = await maybeGetLinkedApiClient();

  if (!client) {
    // Not authenticated
    return [];
  }

  const { data: deployments } = await client.post<Deployment[]>(
    "/api/deployments/",
    {
      uid: await getUID(),
      version: getExtensionVersion(),
      active: selectInstalledDeployments(installedExtensions),
    }
  );

  return deployments;
}

async function activateDeployment(
  dispatch: Dispatch,
  deployment: Deployment,
  installed: ModComponentBase[]
): Promise<void> {
  let isReinstall = false;

  // Clear existing installations of the blueprint
  for (const extension of installed) {
    // Extension won't have recipe if it was locally created by a developer
    if (extension._recipe?.id === deployment.package.package_id) {
      dispatch(
        actions.removeExtension({
          extensionId: extension.id,
        })
      );

      isReinstall = true;
    }
  }

  // Install the blueprint with the service definition
  dispatch(
    actions.installRecipe({
      recipe: deployment.package.config,
      extensionPoints: deployment.package.config.extensionPoints,
      deployment,
      services: await mergeDeploymentServiceConfigurations(
        deployment,
        services.locateAllForId
      ),
      // Assume validation on the backend for options
      optionsArgs: deployment.options_config,
      screen: "extensionConsole",
      isReinstall,
    })
  );

  reportEvent(Events.DEPLOYMENT_ACTIVATE, {
    deployment: deployment.id,
  });
}

async function activateDeployments(
  dispatch: Dispatch,
  deployments: Deployment[],
  installed: ModComponentBase[]
): Promise<void> {
  // Activate as many as we can
  const errors = [];

  for (const deployment of deployments) {
    try {
      // eslint-disable-next-line no-await-in-loop -- modifies redux state
      await activateDeployment(dispatch, deployment, installed);
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length > 0) {
    // XXX: only throwing the first is OK, because the user will see the next error if they fix this error and then
    // activate deployments again
    throw errors[0];
  }
}

export type DeploymentsState = {
  /**
   * `true` iff one or more new deployments/deployment updates are available
   */
  hasUpdate: boolean;

  /**
   * Callback to update the deployments (will prompt the user for permissions if required)
   */
  update: () => Promise<void>;

  /**
   * `true` iff the user needs to update their PixieBrix browser extension version to use the deployment
   */
  extensionUpdateRequired: boolean;

  /**
   * Callback to update the extension. Reloads the extension.
   */
  updateExtension: () => Promise<void>;

  /**
   * `true` when fetching the available deployments
   */
  isLoading: boolean;

  /**
   * The error if fetching available deployments failed, or undefined if loading/deployments were successfully fetched
   */
  error: unknown;
};

function useDeployments(): DeploymentsState {
  const dispatch = useDispatch();
  const installedExtensions = useSelector(selectExtensions);
  const { restrict } = useFlags();

  const { data, isLoading, error } = useAsyncState(async () => {
    // `refreshRegistries` to ensure user has the latest brick definitions. `refreshRegistries` uses
    // memoizedUntilSettled to avoid excessive calls
    const [deployments] = await Promise.all([
      fetchDeployments(installedExtensions),
      refreshRegistries(),
    ]);

    // Log performance to determine if we're having issues with messenger/IDB performance
    const { permissions } = mergePermissionsStatuses(
      await logPromiseDuration(
        "useDeployments:checkDeploymentPermissions",
        Promise.all(
          deployments.map(async (deployment) =>
            checkDeploymentPermissions(deployment, services.locateAllForId)
          )
        )
      )
    );

    return {
      deployments,
      permissions,
    };
  }, [installedExtensions]);

  // Don't default to [] here to avoid re-render
  const { deployments } = data ?? {};

  const [updatedDeployments, extensionUpdateRequired] = useMemo(() => {
    const isUpdated = makeUpdatedFilter(installedExtensions, {
      restricted: restrict("uninstall"),
    });
    const updatedDeployments = (deployments ?? []).filter((x) => isUpdated(x));
    return [
      updatedDeployments,
      checkExtensionUpdateRequired(updatedDeployments),
    ];
  }, [restrict, installedExtensions, deployments]);

  const handleUpdateFromUserGesture = useCallback(async () => {
    // IMPORTANT: can't do a fetch or any potentially stalling operation (including IDB calls) because the call to
    // request permissions must occur within 5 seconds of the user gesture. ensurePermissionsFromUserGesture check
    // must come as early as possible.

    // Always reset. So even if there's an error, the user at least has a grace period before PixieBrix starts
    // notifying them to update again
    dispatch(settingsSlice.actions.resetUpdatePromptTimestamp());

    const { deployments, permissions } = data ?? {};

    if (deployments == null) {
      notify.error("Deployments have not been fetched");
      return;
    }

    let accepted = false;
    try {
      accepted = await ensurePermissionsFromUserGesture(permissions);
    } catch (error) {
      notify.error({
        message: "Error granting permissions, try again",
        error,
      });
      return;
    }

    if (checkExtensionUpdateRequired(deployments)) {
      void browser.runtime.requestUpdateCheck();
      notify.warning(
        "You must update the PixieBrix browser extension to activate the deployment"
      );
      reportEvent(Events.DEPLOYMENT_REJECT_VERSION);
      return;
    }

    if (!accepted) {
      notify.warning("You declined the permissions");
      reportEvent(Events.DEPLOYMENT_REJECT_PERMISSIONS);
      return;
    }

    try {
      // Default should be Dispatch<AnyAction>, but it's showing up as Dispatch<any>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await activateDeployments(dispatch, deployments, installedExtensions);
      notify.success("Activated team deployments");
    } catch (error) {
      notify.error({ message: "Error activating team deployments", error });
    }
  }, [data, dispatch, installedExtensions]);

  const updateExtension = useCallback(async () => {
    await reloadIfNewVersionIsReady();
    notify.info(
      "The extension update hasn't yet been downloaded. Try again in a few minutes."
    );
  }, []);

  return {
    hasUpdate: updatedDeployments?.length > 0,
    update: handleUpdateFromUserGesture,
    updateExtension,
    extensionUpdateRequired,
    isLoading,
    error,
  };
}

const defaultValue: DeploymentsState = {
  hasUpdate: false,
  async update() {},
  extensionUpdateRequired: false,
  async updateExtension() {},
  isLoading: true,
  error: false,
};

const DeploymentsContext = React.createContext<DeploymentsState>(defaultValue);

/**
 * Provides deployment status to the children. Written as React context instead of a hook to allow for a singleton
 * instance tracking the deployment status.
 * @constructor
 * @see DeploymentBanner
 * @see useOnboarding
 */
export const DeploymentsProvider: React.FC = ({ children }) => {
  const deployments = useDeployments();
  return (
    <DeploymentsContext.Provider value={deployments}>
      {children}
    </DeploymentsContext.Provider>
  );
};

export default DeploymentsContext;
