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

import React, { useCallback, useEffect } from "react";
import paneStyles from "@/pageEditor/panes/Pane.module.scss";
import styles from "./GenericInsertPane.module.scss";
import { useDispatch } from "react-redux";
import useAvailableExtensionPoints from "@/pageEditor/hooks/useAvailableExtensionPoints";
import Centered from "@/pageEditor/components/Centered";
import { Button, Row } from "react-bootstrap";
import BrickModal from "@/components/brickModalNoTags/BrickModal";
import { editorSlice } from "@/pageEditor/slices/editorSlice";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faSearch, faTimes } from "@fortawesome/free-solid-svg-icons";
import { internalExtensionPointMetaFactory } from "@/pageEditor/extensionPoints/base";
import { ElementConfig } from "@/pageEditor/extensionPoints/elementConfig";
import { reportEvent } from "@/telemetry/events";
import notify from "@/utils/notify";
import { getCurrentURL, thisTab } from "@/pageEditor/utils";
import {
  showSidebar,
  updateDynamicElement,
} from "@/contentScript/messenger/api";
import { FormState } from "@/pageEditor/extensionPoints/formStateTypes";
import { getExampleBlockPipeline } from "@/pageEditor/exampleExtensionConfig";
import useFlags from "@/hooks/useFlags";
import Loader from "@/components/Loader";

const { addElement } = editorSlice.actions;

const GenericInsertPane: React.FunctionComponent<{
  cancel: () => void;
  config: ElementConfig;
}> = ({ cancel, config }) => {
  const { flagOn } = useFlags();
  const dispatch = useDispatch();

  const showMarketplace = flagOn("page-editor-extension-point-marketplace");

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
          void showSidebar(thisTab);
        }
      } catch (error) {
        // If you're looking for the error message, it's in the logs for the page editor, not the host page
        notify.error({ message: "Error adding element", error });
      }
    },
    [config, dispatch]
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
      } catch (error) {
        notify.error({ message: "Error using existing foundation", error });
      }
    },
    [start, config]
  );

  const addNew = useCallback(async () => {
    try {
      const url = await getCurrentURL();

      const metadata = internalExtensionPointMetaFactory();
      const formState = config.fromNativeElement(
        url,
        metadata,
        undefined,
        []
      ) as FormState;

      formState.extension.blockPipeline = getExampleBlockPipeline(
        formState.type
      );

      await start(formState);

      reportEvent("ExtensionAddNew", {
        type: config.elementType,
      });
    } catch (error) {
      notify.error({ message: "Error using adding new element", error });
    }
  }, [start, config]);

  useEffect(() => {
    if (!showMarketplace) {
      // Add the extension directly since there's no options for the user. The insert pane will flash up quickly.
      void addNew();
    }
  }, [showMarketplace, addNew]);

  const extensionPoints = useAvailableExtensionPoints(config.baseClass);

  if (!showMarketplace) {
    // The insert pane will flash up quickly while the addNew is running.
    return <Loader />;
  }

  return (
    <Centered isScrollable>
      <div className={paneStyles.title}>Build new {config.label} extension</div>
      {config.InsertModeHelpText && (
        <div className="text-left">
          <config.InsertModeHelpText />
        </div>
      )}
      <Row className={styles.buttonRow}>
        <Button variant="primary" onClick={addNew}>
          <FontAwesomeIcon icon={faPlus} /> Create new {config.label}
        </Button>

        <BrickModal
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
