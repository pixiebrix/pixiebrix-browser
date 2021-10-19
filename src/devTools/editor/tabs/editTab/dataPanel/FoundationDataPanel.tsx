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

import React, { useContext } from "react";
import AuthContext from "@/auth/AuthContext";
import { useFormikContext } from "formik";
import { FormState } from "@/devTools/editor/slices/editorSlice";
import { UUID } from "@/core";
import { useSelector } from "react-redux";
import { makeSelectBlockTrace } from "@/devTools/editor/slices/runtimeSelectors";
import { Nav, Tab } from "react-bootstrap";
import JsonTree from "@/components/jsonTree/JsonTree";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import styles from "./DataPanel.module.scss";
import ExtensionPointPreview from "@/devTools/editor/tabs/effect/ExtensionPointPreview";

const FoundationDataPanel: React.FC<{
  firstBlockInstanceId?: UUID;
}> = ({ firstBlockInstanceId }) => {
  const { flags } = useContext(AuthContext);
  const showDeveloperTabs = flags.includes("page-editor-developer");

  const { values: formState } = useFormikContext<FormState>();

  const { extensionPoint } = formState;

  const { record: firstBlockTraceRecord } = useSelector(
    makeSelectBlockTrace(firstBlockInstanceId)
  );

  const defaultActiveKey = firstBlockTraceRecord ? "output" : "preview";

  return (
    <Tab.Container defaultActiveKey={defaultActiveKey}>
      <Nav variant="tabs">
        <Nav.Item className={styles.tabNav}>
          <Nav.Link eventKey="context">Context</Nav.Link>
        </Nav.Item>
        {showDeveloperTabs && (
          <>
            <Nav.Item className={styles.tabNav}>
              <Nav.Link eventKey="formik">Formik</Nav.Link>
            </Nav.Item>
            <Nav.Item className={styles.tabNav}>
              <Nav.Link eventKey="blockConfig">Raw Foundation</Nav.Link>
            </Nav.Item>
          </>
        )}
        <Nav.Item className={styles.tabNav}>
          <Nav.Link eventKey="rendered">Rendered</Nav.Link>
        </Nav.Item>
        <Nav.Item className={styles.tabNav}>
          <Nav.Link eventKey="output">Output</Nav.Link>
        </Nav.Item>
        <Nav.Item className={styles.tabNav}>
          <Nav.Link eventKey="preview">Preview</Nav.Link>
        </Nav.Item>
      </Nav>
      <Tab.Content>
        <Tab.Pane eventKey="context" className={styles.tabPane}>
          <div className="text-muted">
            A foundation is the first step in the execution flow, they do not
            receive inputs
          </div>
        </Tab.Pane>
        {showDeveloperTabs && (
          <>
            <Tab.Pane eventKey="formik" className={styles.tabPane}>
              <div className="text-info">
                <FontAwesomeIcon icon={faInfoCircle} /> This tab is only visible
                to developers
              </div>
              <JsonTree data={formState ?? {}} searchable />
            </Tab.Pane>
            <Tab.Pane eventKey="blockConfig" className={styles.tabPane}>
              <div className="text-info">
                <FontAwesomeIcon icon={faInfoCircle} /> This tab is only visible
                to developers
              </div>
              <JsonTree data={extensionPoint} />
            </Tab.Pane>
          </>
        )}
        <Tab.Pane eventKey="rendered" className={styles.tabPane}>
          <div className="text-muted">
            A foundation is the first step in the execution flow, they do not
            receive inputs
          </div>
        </Tab.Pane>
        <Tab.Pane eventKey="output" className={styles.tabPane}>
          {firstBlockTraceRecord ? (
            <JsonTree
              data={firstBlockTraceRecord.templateContext}
              copyable
              searchable
              label="Data"
              shouldExpandNode={(keyPath) =>
                keyPath.length === 1 && keyPath[0] === "@input"
              }
            />
          ) : (
            <div className="text-muted">
              No trace available, add a brick and run the extension to see the
              data produced by the foundation
            </div>
          )}
        </Tab.Pane>
        <Tab.Pane eventKey="preview" className={styles.tabPane}>
          <ExtensionPointPreview element={formState} />
        </Tab.Pane>
      </Tab.Content>
    </Tab.Container>
  );
};

export default FoundationDataPanel;
