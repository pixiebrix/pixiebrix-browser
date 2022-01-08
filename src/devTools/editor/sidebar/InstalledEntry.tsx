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

import React, { useCallback } from "react";
import { IExtension, UUID } from "@/core";
import { useDispatch } from "react-redux";
import { useAsyncState } from "@/hooks/common";
import {
  extensionToFormState,
  selectType,
} from "@/devTools/editor/extensionPoints/adapter";
import { actions } from "@/devTools/editor/slices/editorSlice";
import { reportError } from "@/telemetry/logging";
import { ListGroup } from "react-bootstrap";
import {
  NotAvailableIcon,
  ExtensionIcon,
} from "@/devTools/editor/sidebar/ExtensionIcons";

/**
 * A sidebar menu entry corresponding to an installed/saved extension point
 * @see DynamicEntry
 */
const InstalledEntry: React.FunctionComponent<{
  extension: IExtension;
  activeElement: UUID | null;
  available: boolean;
}> = ({ extension, available, activeElement }) => {
  const dispatch = useDispatch();
  const [type] = useAsyncState(async () => selectType(extension), [
    extension.extensionPointId,
  ]);

  const selectHandler = useCallback(
    async (extension: IExtension) => {
      try {
        const state = await extensionToFormState(extension);
        // FIXME: is where we need to uninstall the extension because it will now be a dynamic element? Or should it
        //  be getting handled by lifecycle.ts? Need to add some logging to figure out how other ones work
        dispatch(actions.selectInstalled(state));
      } catch (error) {
        reportError(error);
        dispatch(actions.adapterError({ uuid: extension.id, error }));
      }
    },
    [dispatch]
  );

  return (
    <ListGroup.Item
      action
      active={extension.id === activeElement}
      key={`installed-${extension.id}`}
      onClick={async () => selectHandler(extension)}
    >
      <ExtensionIcon type={type} /> {extension.label ?? extension.id}
      {!available && (
        <span className="ml-2">
          <NotAvailableIcon />
        </span>
      )}
    </ListGroup.Item>
  );
};

export default InstalledEntry;
