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

import React from "react";
import { useFormikContext } from "formik";
import { UUID } from "@/core";
import { useSelector } from "react-redux";
import { makeSelectBlockTrace } from "@/pageEditor/slices/runtimeSelectors";
import { Nav, Tab } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import dataPanelStyles from "@/pageEditor/tabs/dataPanelTabs.module.scss";
import ExtensionPointPreview from "@/pageEditor/tabs/effect/ExtensionPointPreview";
import useDataPanelActiveTabKey from "@/pageEditor/tabs/editTab/dataPanel/useDataPanelActiveTabKey";
import useFlags from "@/hooks/useFlags";
import { FormState } from "@/pageEditor/pageEditorTypes";
import PageStateTab from "./PageStateTab";
import { DataPanelTabKey } from "@/pageEditor/tabs/editTab/dataPanel/dataPanelTypes";
import DataTabJsonTree from "./DataTabJsonTree";

const FoundationDataPanel: React.FC<{
  firstBlockInstanceId?: UUID;
}> = ({ firstBlockInstanceId }) => {
  const { flagOn } = useFlags();
  const showDeveloperTabs = flagOn("page-editor-developer");

  const { values: formState } = useFormikContext<FormState>();

  const { extensionPoint } = formState;

  const { record: firstBlockTraceRecord } = useSelector(
    makeSelectBlockTrace(firstBlockInstanceId)
  );

  const [activeTabKey, onSelectTab] = useDataPanelActiveTabKey(
    firstBlockTraceRecord ? DataPanelTabKey.Output : DataPanelTabKey.Preview
  );

  return (
    <Tab.Container activeKey={activeTabKey} onSelect={onSelectTab}>
      <Nav variant="tabs">
        <Nav.Item className={dataPanelStyles.tabNav}>
          <Nav.Link eventKey={DataPanelTabKey.Context}>Context</Nav.Link>
        </Nav.Item>
        {showDeveloperTabs && (
          <>
            <Nav.Item className={dataPanelStyles.tabNav}>
              <Nav.Link eventKey={DataPanelTabKey.Formik}>Formik</Nav.Link>
            </Nav.Item>
            <Nav.Item className={dataPanelStyles.tabNav}>
              <Nav.Link eventKey={DataPanelTabKey.BlockConfig}>
                Raw Foundation
              </Nav.Link>
            </Nav.Item>
          </>
        )}
        <Nav.Item className={dataPanelStyles.tabNav}>
          <Nav.Link eventKey={DataPanelTabKey.Rendered}>Rendered</Nav.Link>
        </Nav.Item>
        <Nav.Item className={dataPanelStyles.tabNav}>
          <Nav.Link eventKey={DataPanelTabKey.Output}>Output</Nav.Link>
        </Nav.Item>
        <Nav.Item className={dataPanelStyles.tabNav}>
          <Nav.Link eventKey={DataPanelTabKey.Preview}>Preview</Nav.Link>
        </Nav.Item>
        <Nav.Item className={dataPanelStyles.tabNav}>
          <Nav.Link eventKey={DataPanelTabKey.PageState}>Page State</Nav.Link>
        </Nav.Item>
      </Nav>
      <Tab.Content>
        <Tab.Pane
          eventKey={DataPanelTabKey.Context}
          className={dataPanelStyles.tabPane}
        >
          <div className="text-muted">
            A foundation is the first step in the execution flow, they do not
            receive inputs
          </div>
        </Tab.Pane>
        {showDeveloperTabs && (
          <>
            <Tab.Pane
              eventKey={DataPanelTabKey.Formik}
              className={dataPanelStyles.tabPane}
              mountOnEnter
              unmountOnExit
            >
              <div className="text-info">
                <FontAwesomeIcon icon={faInfoCircle} /> This tab is only visible
                to developers
              </div>
              <DataTabJsonTree
                data={formState ?? {}}
                searchable
                tabKey={DataPanelTabKey.Formik}
              />
            </Tab.Pane>
            <Tab.Pane
              eventKey={DataPanelTabKey.BlockConfig}
              className={dataPanelStyles.tabPane}
              mountOnEnter
              unmountOnExit
            >
              <div className="text-info">
                <FontAwesomeIcon icon={faInfoCircle} /> This tab is only visible
                to developers
              </div>
              <DataTabJsonTree
                data={extensionPoint}
                tabKey={DataPanelTabKey.BlockConfig}
              />
            </Tab.Pane>
          </>
        )}
        <Tab.Pane
          eventKey={DataPanelTabKey.Rendered}
          className={dataPanelStyles.tabPane}
        >
          <div className="text-muted">
            A foundation is the first step in the execution flow, they do not
            receive inputs
          </div>
        </Tab.Pane>
        <Tab.Pane
          eventKey={DataPanelTabKey.Output}
          className={dataPanelStyles.tabPane}
          mountOnEnter
          unmountOnExit
        >
          {firstBlockTraceRecord ? (
            <DataTabJsonTree
              data={firstBlockTraceRecord.templateContext}
              copyable
              searchable
              tabKey={DataPanelTabKey.Output}
              label="Data"
            />
          ) : (
            <div className="text-muted">
              No trace available, add a brick and run the extension to see the
              data produced by the foundation
            </div>
          )}
        </Tab.Pane>
        <Tab.Pane
          eventKey={DataPanelTabKey.Preview}
          className={dataPanelStyles.tabPane}
          mountOnEnter
          unmountOnExit
        >
          <ExtensionPointPreview element={formState} />
        </Tab.Pane>
        <Tab.Pane
          eventKey={DataPanelTabKey.PageState}
          className={dataPanelStyles.tabPane}
          mountOnEnter
          unmountOnExit
        >
          <PageStateTab />
        </Tab.Pane>
      </Tab.Content>
    </Tab.Container>
  );
};

export default FoundationDataPanel;
