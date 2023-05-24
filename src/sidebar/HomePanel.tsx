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
import React from "react";
import { type StaticPanelEntry } from "@/types/sidebarTypes";
import { ListGroup, Row, Container, Button } from "react-bootstrap";
import type { Column } from "react-table";
import type {
  Installable,
  InstallableViewItem,
} from "@/extensionConsole/pages/blueprints/blueprintsTypes";
import useInstallableViewItems from "@/extensionConsole/pages/blueprints/useInstallableViewItems";
import Loader from "@/components/Loader";
import { useTable } from "react-table";
import useInstallables from "@/extensionConsole/pages/blueprints/useInstallables";
import { ErrorDisplay } from "@/layout/ErrorDisplay";
import BlueprintActions from "@/extensionConsole/pages/blueprints/BlueprintActions";
import useInstallableViewItemActions from "@/extensionConsole/pages/blueprints/useInstallableViewItemActions";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons";

const columns: Array<Column<InstallableViewItem>> = [
  {
    Header: "Name",
    accessor: "name",
  },
  {
    Header: "Last updated",
    accessor: "updatedAt",
    sortInverted: true,
  },
];

const ListItem: React.FunctionComponent<{
  installableItem: InstallableViewItem;
}> = ({ installableItem }) => {
  const { name, icon } = installableItem;
  const { requestPermissions } = useInstallableViewItemActions(installableItem);

  return (
    <ListGroup.Item>
      <div className="d-flex align-items-center">
        <div className="flex-shrink-0">{icon}</div>
        <div className="flex-grow-1">
          <div className="d-flex align-items-center">
            <h5 className="flex-grow-1">{name}</h5>
          </div>
          {requestPermissions && (
            <Button
              variant="link"
              size="sm"
              className="p-0"
              onClick={requestPermissions}
            >
              <FontAwesomeIcon icon={faExclamationCircle} /> Grant Permissions
            </Button>
          )}
        </div>
        <div className="flex-shrink-0">
          <BlueprintActions installableViewItem={installableItem} />
        </div>
      </div>
    </ListGroup.Item>
  );
};

const ActiveBlueprintsList: React.FunctionComponent<{
  installables: Installable[];
}> = ({ installables }) => {
  const { installableViewItems, isLoading } =
    useInstallableViewItems(installables);

  const tableInstance = useTable<InstallableViewItem>({
    columns,
    data: installableViewItems.filter(
      (installableViewItem) => installableViewItem.status === "Active"
    ),
  });

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <ListGroup {...tableInstance.getTableProps()} className="flex-grow">
          {tableInstance.rows.map((row) => {
            tableInstance.prepareRow(row);
            return (
              <ListItem
                key={row.original.sharing.packageId}
                installableItem={row.original}
              />
            );
          })}
        </ListGroup>
      )}
    </>
  );
};

const HomePanel: React.FunctionComponent = () => {
  const { installables, error } = useInstallables();

  return (
    <Container>
      Active mods
      <Row>
        {error ? (
          <ErrorDisplay error={error} />
        ) : (
          <ActiveBlueprintsList installables={installables} />
        )}
      </Row>
    </Container>
  );
};

export const HOME_PANEL: StaticPanelEntry = {
  type: "staticPanel",
  heading: "Home",
  key: "home",
};

export default HomePanel;
