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

import React, { useCallback, useContext } from "react";
import { useDispatch } from "react-redux";
import { DevToolsContext } from "@/devTools/context";
import { getTabInfo } from "@/background/devtools";
import config from "@/devTools/editor/extensionPoints/menuItem";
import useAvailableExtensionPoints from "@/devTools/editor/hooks/useAvailableExtensionPoints";
import {
  MenuDefinition,
  MenuItemExtensionPoint,
} from "@/extensionPoints/menuItemExtension";
import Centered from "@/devTools/editor/components/Centered";
import { Alert, Button } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCube, faInfo } from "@fortawesome/free-solid-svg-icons";
import BlockModal from "@/components/fields/BlockModal";
import { ExtensionPointConfig } from "@/extensionPoints/types";
import { editorSlice } from "@/devTools/editor/editorSlice";
import { reportEvent } from "@/telemetry/events";

const { addElement } = editorSlice.actions;

type MenuItemWithConfig = MenuItemExtensionPoint & {
  rawConfig: ExtensionPointConfig<MenuDefinition>;
};

const InsertMenuItemPane: React.FunctionComponent<{ cancel: () => void }> = ({
  cancel,
}) => {
  const dispatch = useDispatch();
  const { port } = useContext(DevToolsContext);

  const addExistingButton = useCallback(
    async (extensionPoint: MenuItemWithConfig) => {
      if (!("rawConfig" in extensionPoint)) {
        throw new Error(
          "Cannot use menuItem extension point without config in the Page Editor"
        );
      }
      const { url } = await getTabInfo(port);
      const state = await config.fromExtensionPoint(
        url,
        extensionPoint.rawConfig
      );

      // TODO: report if created new, or using existing foundation
      reportEvent("PageEditorStart", {
        type: config.elementType,
      });

      dispatch(addElement(state));
    },
    [port, dispatch]
  );

  const menuItemExtensionPoints = useAvailableExtensionPoints(
    MenuItemExtensionPoint
  );

  return (
    <Centered>
      <div className="PaneTitle">Inserting Button/Menu Item</div>

      <div className="text-left">
        <p>
          Click on an existing <code>button</code> or button-like element to add
          a button that that button group. You can also select a menu item or
          nav link.
        </p>

        <div>
          <Alert variant="info">
            <FontAwesomeIcon icon={faInfo} /> <b>Tip:</b> to increase the
            accuracy of detection, you can Shift+Click one or more buttons in
            the button group. Click a button without holding Shift to complete
            placement.
          </Alert>
        </div>
      </div>
      <div>
        <BlockModal
          blocks={menuItemExtensionPoints ?? []}
          caption="Select button foundation"
          renderButton={({ show }) => (
            <Button
              variant="info"
              onClick={show}
              disabled={!menuItemExtensionPoints?.length}
            >
              <FontAwesomeIcon icon={faCube} /> Use Existing Button
            </Button>
          )}
          onSelect={async (block) =>
            addExistingButton(block as MenuItemWithConfig)
          }
        />

        <Button variant="danger" className="ml-2" onClick={cancel}>
          Cancel Insert
        </Button>
      </div>
    </Centered>
  );
};

export default InsertMenuItemPane;
