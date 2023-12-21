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

import { Card, Nav, Tab } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuilding,
  faEyeSlash,
  faGlobe,
  faSave,
  faTimesCircle,
} from "@fortawesome/free-solid-svg-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFormikContext } from "formik";
import CodeEditor from "./CodeEditor";
import SharingTable from "./SharingTable";
import { sortBy } from "lodash";
import { type UUID } from "@/types/stringTypes";
import BrickReference from "@/extensionConsole/pages/brickEditor/referenceTab/BrickReference";
import { useAsyncState } from "@/hooks/common";
import serviceRegistry from "@/integrations/registry";
import blockRegistry from "@/bricks/registry";
import extensionPointRegistry from "@/starterBricks/registry";
import ConfirmNavigationModal from "@/components/ConfirmNavigationModal";
import notify from "@/utils/notify";
import BrickHistory from "@/extensionConsole/pages/brickEditor/BrickHistory";
import { useParams } from "react-router";
import LogCard from "@/components/logViewer/LogCard";
import { type Metadata } from "@/types/registryTypes";
import { isMac } from "@/utils/browserUtils";
import { getExtensionConsoleUrl } from "@/utils/extensionUtils";
import { appApi } from "@/services/api";

const SharingIcon: React.FunctionComponent<{
  isPublic: boolean;
  organizations: boolean;
}> = ({ isPublic, organizations }) => {
  if (isPublic) {
    return <FontAwesomeIcon icon={faGlobe} />;
  }

  if (organizations) {
    return <FontAwesomeIcon icon={faBuilding} />;
  }

  return <FontAwesomeIcon icon={faEyeSlash} />;
};

export interface EditorValues {
  reactivate?: boolean;
  public: boolean;
  config: string;
  organizations: string[];
}

interface OwnProps {
  showTemplates?: boolean;
  showLogs?: boolean;
}

function useOpenEditorTab() {
  const [getEditablePackages] =
    appApi.endpoints.getEditablePackages.useLazyQuery();

  return useCallback(
    async (id: string) => {
      let brick;

      try {
        const editablePackages = await getEditablePackages(
          undefined,
          true,
        ).unwrap();
        brick = editablePackages.find((x) => x.name === id);
      } catch (error) {
        notify.error({
          message: `Something went wrong while opening ${id}`,
          error,
        });
      }

      if (brick) {
        console.debug("Open editor for brick: %s", id, { brick });
        window.open(getExtensionConsoleUrl(`workshop/bricks/${brick.id}`));
      } else {
        notify.warning(`You cannot edit brick: ${id}`);
      }
    },
    [getEditablePackages],
  );
}

const Editor = ({ showLogs = true }: OwnProps) => {
  const [activeTab, setTab] = useState("edit");
  const [editorWidth, setEditorWidth] = useState<number>();
  const [selectedReference, setSelectedReference] = useState<Metadata>();
  const { errors, values, dirty } = useFormikContext<EditorValues>();
  const { id: brickId } = useParams<{ id: UUID }>();

  const [bricks] = useAsyncState(async () => {
    const [extensionPoints, bricks, services] = await Promise.all([
      extensionPointRegistry.all(),
      blockRegistry.all(),
      serviceRegistry.all(),
    ]);
    return [...extensionPoints, ...bricks, ...services];
  }, []);

  const openReference = useCallback(
    (id: string) => {
      const brick = bricks?.find((x) => x.id === id);
      if (brick) {
        console.debug("Open reference for brick: %s", brick.id, { brick });
        setSelectedReference(brick);
        setTab("reference");
      } else {
        console.debug("Known bricks", {
          bricks: sortBy(bricks.map((x) => x.id)),
        });
        notify.warning(`Cannot find brick: ${id}`);
      }
    },
    [setTab, bricks, setSelectedReference],
  );

  const openEditorTab = useOpenEditorTab();

  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current) {
      setEditorWidth(editorRef.current.offsetWidth);
    }
  }, [editorRef]);

  return (
    <div>
      <ConfirmNavigationModal />
      <div className="mb-3">
        <ul className="list-unstyled list-inline">
          <li className="list-inline-item">
            <kbd>{isMac() ? "Cmd" : "Ctrl"}</kbd> + <kbd>S</kbd>: Save
          </li>
          <li className="list-inline-item mx-3">
            <kbd>{isMac() ? "Cmd" : "Ctrl"}</kbd> + <kbd>B</kbd>: View Reference
          </li>
          <li className="list-inline-item mx-3">
            <kbd>{isMac() ? "Cmd" : "Ctrl"}</kbd> + <kbd>O</kbd>: Open Brick
          </li>
          <li className="list-inline-item mx-3">
            <kbd>{isMac() ? "Cmd" : "Ctrl"}</kbd> + <kbd>F</kbd>: Search
          </li>
        </ul>
      </div>
      <Card ref={editorRef}>
        <Tab.Container
          id="editor-container"
          defaultActiveKey={activeTab}
          activeKey={activeTab}
        >
          <Card.Header>
            <Nav variant="tabs" onSelect={setTab}>
              <Nav.Link eventKey="edit">
                {dirty ? (
                  <span className="text-danger">
                    Editor{" "}
                    <FontAwesomeIcon
                      icon={errors.config ? faTimesCircle : faSave}
                    />
                  </span>
                ) : (
                  "Editor"
                )}
              </Nav.Link>
              <Nav.Link eventKey="share">
                Sharing{" "}
                <SharingIcon
                  isPublic={values.public}
                  organizations={values.organizations.length > 0}
                />
              </Nav.Link>
              {showLogs && <Nav.Link eventKey="logs">Logs</Nav.Link>}
              <Nav.Link eventKey="reference">Reference</Nav.Link>
              <Nav.Link eventKey="history" disabled={!brickId}>
                History
              </Nav.Link>
            </Nav>
          </Card.Header>

          <Tab.Content className="p-0">
            <Tab.Pane eventKey="edit" className="p-0">
              <CodeEditor
                name="config"
                width={editorWidth}
                openDefinition={openReference}
                openEditor={openEditorTab}
              />
            </Tab.Pane>
            <Tab.Pane eventKey="share" className="p-0">
              <SharingTable />
            </Tab.Pane>

            {showLogs && (
              <Tab.Pane eventKey="logs" className="p-0">
                <LogCard />
              </Tab.Pane>
            )}

            <Tab.Pane eventKey="reference" className="p-0">
              <BrickReference
                key={selectedReference?.id}
                bricks={bricks}
                initialSelected={selectedReference}
              />
            </Tab.Pane>

            <Tab.Pane eventKey="history" className="p-0">
              {brickId ? (
                <BrickHistory brickId={brickId} />
              ) : (
                // This should never be shown since we disable the tab when creating a new brick
                <div>Save the brick to view its version history</div>
              )}
            </Tab.Pane>
          </Tab.Content>
        </Tab.Container>
      </Card>
    </div>
  );
};

export default Editor;
