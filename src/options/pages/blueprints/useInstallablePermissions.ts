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

import { IExtension } from "@/core";
import { useCallback, useState } from "react";
import { useAsyncEffect } from "use-async-effect";
import { ensureAllPermissions, extensionPermissions } from "@/permissions";
import { mergePermissions } from "@/utils/permissions";
import { containsPermissions } from "@/background/messenger/api";

/**
 * WARNING: This hook swallows errors (to simplify the behavior for the blueprints page.
 * Outside of the `BlueprintsPage` you probably want to use useAsyncState with `containsPermissions`
 * @see containsPermissions
 * @see extensionPermissions
 */
function useInstallablePermissions(extensions: IExtension[]): {
  hasPermissions: boolean;
  requestPermissions: () => Promise<boolean>;
} {
  // By default, assume the extensions have permissions so that the UI can optimistically render the state as if
  // the permissions had extensions
  const [hasPermissions, setHasPermissions] = useState<boolean>(true);

  useAsyncEffect(
    async (isMounted) => {
      try {
        const permissions = mergePermissions(
          await Promise.all(
            extensions.map(async (x) => extensionPermissions(x))
          )
        );
        const hasPermissions = await containsPermissions(permissions);
        if (!isMounted()) return;
        setHasPermissions(hasPermissions);
      } catch {
        // If there's an error checking permissions, just assume they're OK. The user will need to fix the configuration
        // before we can check permissions.
        setHasPermissions(true);
      }
    },
    [extensions]
  );

  const requestPermissions = useCallback(async () => {
    const permissions = mergePermissions(
      await Promise.all(extensions.map(async (x) => extensionPermissions(x)))
    );
    const accepted = await ensureAllPermissions(permissions);
    setHasPermissions(accepted);
    if (accepted) {
      // TODO: in the future, listen for a permissions event in this hook so the status can update without redirecting the page
      // Reload the page so all the Grant Permissions buttons are in sync.
      location.reload();
    }

    return accepted;
  }, [extensions]);

  return {
    hasPermissions,
    requestPermissions,
  };
}

export default useInstallablePermissions;
