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

import { type ServiceDependency } from "@/types/serviceTypes";
import notify from "@/utils/notify";
import { useFormikContext } from "formik";
import { useAsyncState } from "@/hooks/common";
import { collectPermissions, ensureAllPermissions } from "@/permissions";
import { resolveDefinitions } from "@/registry/internal";
import {
  containsPermissions,
  services as locator,
} from "@/background/messenger/api";
import { useCallback } from "react";
import { reportEvent } from "@/telemetry/events";
import { type CloudExtension } from "@/types/contract";
import { type ResolvedExtensionDefinition } from "@/types/recipeTypes";

function useEnsurePermissions(
  extension: CloudExtension,
  services: ServiceDependency[]
) {
  const { submitForm } = useFormikContext();

  const [permissionState, isPending, error] = useAsyncState(async () => {
    await locator.refreshLocal();
    const resolved = await resolveDefinitions({ ...extension, services });

    const configured = services.filter((x) => x.config);

    const permissions = await collectPermissions(
      [resolved].map(
        (extension) =>
          ({
            id: extension.extensionPointId,
            config: extension.config,
            services: Object.fromEntries(
              services.map((service) => [service.outputKey, service.id])
            ),
          } as ResolvedExtensionDefinition)
      ),
      configured.map(({ id, config }) => ({ id, config }))
    );
    const enabled = await containsPermissions(permissions);
    return {
      enabled,
      permissions,
    };
  }, [extension, services]);

  const { enabled, permissions } = permissionState ?? {
    enabled: false,
    permissions: null,
  };

  const request = useCallback(async () => {
    let accepted = false;

    try {
      accepted = await ensureAllPermissions(permissions);
    } catch (error) {
      notify.error({
        message: "Error granting permissions",
        error,
      });
      return false;
    }

    if (!accepted) {
      // Event is tracked in `activate` callback
      notify.warning("You declined the permissions");
      return false;
    }

    return true;
  }, [permissions]);

  const activate = useCallback(() => {
    // Can't use async here because Firefox loses track of trusted UX event
    // eslint-disable-next-line @typescript-eslint/promise-function-async, promise/prefer-await-to-then
    void request().then((accepted: boolean) => {
      if (accepted) {
        // The event gets reported in the reducer
        return submitForm();
      }

      reportEvent("CloudExtensionRejectPermissions", {
        extensionId: extension.id,
      });
    });
  }, [request, submitForm, extension]);

  return {
    enabled,
    request,
    permissions,
    activate,
    isPending,
    error,
  };
}

export default useEnsurePermissions;
