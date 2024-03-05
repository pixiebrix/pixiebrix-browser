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

import { activateDeployments } from "@/extensionConsole/pages/deployments/activateDeployments";
import useFlags from "@/hooks/useFlags";
import useModPermissions from "@/mods/hooks/useModPermissions";
import { type DeploymentModDefinitionPair } from "@/types/contract";
import { type ModComponentBase } from "@/types/modComponentTypes";
import notify from "@/utils/notify";
import { type Dispatch } from "@reduxjs/toolkit";
import { useState } from "react";
import { useDispatch } from "react-redux";
import useAsyncEffect from "use-async-effect";

type UseAutoDeployReturn = {
  /**
   * `true` if the deployments are still being loaded or if the deployments are being automatically deployed.
   */
  isAutoDeploying: boolean;
};

function useAutoDeploy({
  deploymentModDefinitionPairs,
  installedExtensions,
  extensionUpdateRequired,
}: {
  deploymentModDefinitionPairs: DeploymentModDefinitionPair[];
  installedExtensions: ModComponentBase[];
  extensionUpdateRequired: boolean;
}): UseAutoDeployReturn {
  const dispatch = useDispatch<Dispatch>();
  // `true` until deployments have been fetched and activated
  const [
    isFetchingAndActivatingDeployments,
    setIsFetchingAndActivatingDeployments,
  ] = useState(true);
  // Only `true` while deployments are being activated. Prevents multiple activations from happening at once.
  const [isActivationInProgress, setIsActivationInProgress] = useState(false);
  const { hasPermissions } = useModPermissions(installedExtensions);
  const { restrict } = useFlags();

  /**
   *  Users who can uninstall (admins and developers) should not have auto-deploy enabled
   *  Deployments will still auto-activate in the background, but won't downgrade the user
   *  so they can work on developing new versions of the mod.
   */
  const shouldAutoDeploy = restrict("uninstall");

  useAsyncEffect(
    async (isMounted) => {
      if (
        !isMounted() ||
        // Still loading deployments or already deploying
        !deploymentModDefinitionPairs ||
        isActivationInProgress
      ) {
        return;
      }

      // No deployments to deploy or user interaction required
      if (
        deploymentModDefinitionPairs.length === 0 ||
        !hasPermissions ||
        extensionUpdateRequired ||
        !shouldAutoDeploy
      ) {
        setIsFetchingAndActivatingDeployments(false);
        return;
      }

      // Attempt to automatically deploy the deployments
      try {
        setIsActivationInProgress(true);
        await activateDeployments({
          dispatch,
          deploymentModDefinitionPairs,
          installed: installedExtensions,
        });
        notify.success("Updated team deployments");
      } catch (error) {
        notify.error({ message: "Error updating team deployments", error });
      } finally {
        setIsActivationInProgress(false);
        setIsFetchingAndActivatingDeployments(false);
      }
    },
    [hasPermissions, deploymentModDefinitionPairs],
  );

  return { isAutoDeploying: isFetchingAndActivatingDeployments };
}

export default useAutoDeploy;
