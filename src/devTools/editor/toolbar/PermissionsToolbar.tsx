/*
 * Copyright (C) 2021 PixieBrix, Inc.
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

import React, { useCallback, useState } from "react";
import { FormState } from "@/devTools/editor/editorSlice";
import { Button, ButtonGroup } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faShieldAlt } from "@fortawesome/free-solid-svg-icons";
import { ADAPTERS } from "@/devTools/editor/extensionPoints/adapter";
import {
  checkPermissions,
  ensureAllPermissions,
  extensionPermissions,
} from "@/permissions";
import { fromJS as extensionPointFactory } from "@/extensionPoints/factory";
import { Permissions } from "webextension-polyfill-ts";
import useAsyncEffect from "use-async-effect";
import { useDebounce } from "use-debounce";
import { useToasts } from "react-toast-notifications";

type PermissionsState = {
  hasPermissions: boolean;
  permissions: Permissions.Permissions[];
};

const PERMISSION_UPDATE_MILLIS = 200;

const PermissionsToolbar: React.FunctionComponent<{
  element: FormState;
  disabled: boolean;
}> = ({ element, disabled }) => {
  const { addToast } = useToasts();

  const [state, setState] = useState<PermissionsState>({
    hasPermissions: true,
    permissions: [],
  });

  const [debouncedElement] = useDebounce(element, PERMISSION_UPDATE_MILLIS, {
    leading: false,
    trailing: true,
  });

  const run = useCallback(
    async (element: FormState, disabled: boolean) => {
      if (disabled) {
        return;
      }

      const { definition: factory } = ADAPTERS.get(element.type);
      const { extension, extensionPoint: extensionPointConfig } = factory(
        element
      );
      const extensionPoint = await extensionPointFactory(extensionPointConfig);

      // We don't want the extension point availability because we already have access to it on the page
      // because the user is using the devtools. We can request additional permissions on save
      const permissions = await extensionPermissions(extension, {
        extensionPoint,
        includeExtensionPoint: false,
      });
      const hasPermissions = await checkPermissions(permissions);
      setState({ permissions, hasPermissions });
    },
    [setState]
  );

  useAsyncEffect(async () => {
    if (!disabled) {
      await run(debouncedElement, disabled);
    }
  }, [debouncedElement, disabled]);

  const request = useCallback(async () => {
    if (await ensureAllPermissions(state.permissions)) {
      addToast("Granted additional permissions", {
        appearance: "success",
        autoDismiss: true,
      });
      await run(debouncedElement, disabled);
    } else {
      addToast("You declined the additional required permissions", {
        appearance: "info",
        autoDismiss: true,
      });
    }
  }, [addToast, state.permissions, run, debouncedElement, disabled]);

  return (
    <ButtonGroup>
      {!state.hasPermissions && (
        <Button
          disabled={disabled}
          onClick={request}
          size="sm"
          variant="primary"
        >
          <FontAwesomeIcon icon={faShieldAlt} /> Grant Permissions
        </Button>
      )}
    </ButtonGroup>
  );
};

export default PermissionsToolbar;
