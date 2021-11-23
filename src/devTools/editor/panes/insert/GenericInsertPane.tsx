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
import useAvailableExtensionPoints from "@/devTools/editor/hooks/useAvailableExtensionPoints";
import Centered from "@/devTools/editor/components/Centered";
import { Button, Row } from "react-bootstrap";
import BlockModal from "@/components/brickModal/BrickModal";
import { editorSlice, FormState } from "@/devTools/editor/slices/editorSlice";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faSearch, faTimes } from "@fortawesome/free-solid-svg-icons";
import { internalExtensionPointMetaFactory } from "@/devTools/editor/extensionPoints/base";
import { ElementConfig } from "@/devTools/editor/extensionPoints/elementConfig";
import { reportEvent } from "@/telemetry/events";
import { useToasts } from "react-toast-notifications";
import { reportError } from "@/telemetry/logging";
import { getCurrentURL, thisTab } from "@/devTools/utils";
import styles from "./GenericInsertPane.module.scss";
import {
  showActionPanel,
  updateDynamicElement,
} from "@/contentScript/messenger/api";

const { addElement } = editorSlice.actions;

const GenericInsertPane: React.FunctionComponent<{
  cancel: () => void;
  config: ElementConfig;
}> = ({ cancel, config }) => {
  const dispatch = useDispatch();
  const { addToast } = useToasts();
  const { port } = useContext(DevToolsContext);

  const start = useCallback(
    async (state: FormState) => {
      try {
        dispatch(addElement(state));

        await updateDynamicElement(thisTab, config.asDynamicElement(state));

        // TODO: report if created new, or using existing foundation
        reportEvent("PageEditorStart", {
          type: config.elementType,
        });

        if (config.elementType === "actionPanel") {
          // For convenience, open the side panel if it's not already open so that the user doesn't
          // have to manually toggle it
          void showActionPanel(thisTab);
        }
      } catch (error: unknown) {
        reportError(error);
        addToast("Error adding element", {
          autoDismiss: true,
          appearance: "error",
        });
      }
    },
    [config, port, dispatch, addToast]
  );

  const addExisting = useCallback(
    async (extensionPoint) => {
      try {
        const url = await getCurrentURL();
        await start(
          (await config.fromExtensionPoint(
            url,
            extensionPoint.rawConfig
          )) as FormState
        );
      } catch (error: unknown) {
        reportError(error);
        addToast("Error using existing foundation", {
          autoDismiss: true,
          appearance: "error",
        });
      }
    },
    [start, config, addToast]
  );

  const addNew = useCallback(async () => {
    try {
      const url = await getCurrentURL();

      const metadata = internalExtensionPointMetaFactory();

      await start(
        config.fromNativeElement(url, metadata, undefined, []) as FormState
      );
    } catch (error: unknown) {
      reportError(error);
      addToast("Error using adding new element", {
        autoDismiss: true,
        appearance: "error",
      });
    }
  }, [start, config, addToast]);

  const extensionPoints = useAvailableExtensionPoints(config.baseClass);

  return (
    <Centered isScrollable>
      <div className="PaneTitle">Build new {config.label} extension</div>
      <div className="text-left">{config.insertModeHelp}</div>
      <Row className={styles.buttonRow}>
        <Button variant="primary" onClick={addNew}>
          <FontAwesomeIcon icon={faPlus} /> Create new {config.label}
        </Button>

        <BlockModal
          bricks={extensionPoints ?? []}
          renderButton={(onClick) => (
            <Button
              variant="info"
              onClick={onClick}
              disabled={!extensionPoints?.length}
              className={styles.searchButton}
            >
              <FontAwesomeIcon icon={faSearch} /> Search Marketplace
            </Button>
          )}
          onSelect={async (block) => addExisting(block)}
        />
      </Row>
      <Row className={styles.cancelRow}>
        <Button variant="danger" className="m-3" onClick={cancel}>
          <FontAwesomeIcon icon={faTimes} /> Cancel
        </Button>
      </Row>
    </Centered>
  );
};

export default GenericInsertPane;
