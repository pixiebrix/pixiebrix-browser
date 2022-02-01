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

import { Button, Col, Row as BootstrapRow } from "react-bootstrap";
import React, {
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  getDescription,
  getLabel,
  getPackageId,
  getSharingType,
  getUpdatedAt,
} from "./installableUtils";
import AuthContext from "@/auth/AuthContext";
import {
  Column,
  ColumnInstance,
  useFilters,
  useGroupBy,
  useSortBy,
  useTable,
} from "react-table";
import Select from "react-select";
import {
  faList,
  faSortAmountDownAlt,
  faSortAmountUpAlt,
  faThLarge,
} from "@fortawesome/free-solid-svg-icons";
import TableView from "./tableView/TableView";
import ListFilters from "./ListFilters";
import { Installable, InstallableViewItem } from "./blueprintsTypes";
import GridView from "./gridView/GridView";

const getFilterOptions = (column: ColumnInstance) => {
  const options = new Set();
  for (const row of column.preFilteredRows) {
    options.add(row.values[column.id]);
  }

  return [...options.values()];
};

const getInstallableRows = (
  installables: Installable[],
  scope: string
): InstallableViewItem[] =>
  installables.map(
    (installable): InstallableViewItem => ({
      name: getLabel(installable),
      description: getDescription(installable),
      sharing: {
        packageId: getPackageId(installable),
        source: getSharingType(installable, scope),
      },
      updatedAt: getUpdatedAt(installable),
      status: installable.active ? "Active" : "Uninstalled",
      installable,
    })
  );

// These react-table columns aren't rendered as column headings,
// but used to expose grouping, sorting, and filtering utilities
// (and eventually pagination & global searching) on InstallableRows
const columns: Array<Column<InstallableViewItem>> = [
  {
    Header: "Name",
    accessor: "name",
    disableGroupBy: true,
    disableFilters: true,
  },
  {
    Header: "Sharing",
    // @ts-expect-error -- react-table allows nested accessors
    accessor: "sharing.source.label",
  },
  {
    Header: "Last modified",
    accessor: "updatedAt",
    disableGroupBy: true,
    disableFilters: true,
  },
  {
    Header: "Status",
    accessor: "status",
  },
];

const BlueprintsCard: React.FunctionComponent<{
  installables: Installable[];
}> = ({ installables }) => {
  const { scope } = useContext(AuthContext);
  const data: InstallableViewItem[] = useMemo(
    () => getInstallableRows(installables, scope),
    [installables, scope]
  );

  useEffect(() => {
    setAllFilters([{ id: "status", value: "Active" }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on first mount
  }, []);

  const tableInstance = useTable<InstallableViewItem>(
    { columns, data },
    useFilters,
    useGroupBy,
    useSortBy
  );

  const [view, setView] = useState<"list" | "grid">("list");

  const {
    rows,
    flatHeaders,
    // @ts-expect-error -- for some reason, react-table index.d.ts UseGroupByInstanceProps
    // doesn't have setGroupBy?
    setGroupBy,
    setAllFilters,
    setSortBy,
    state: { groupBy, sortBy, filters },
  } = tableInstance;

  const isGrouped = groupBy.length > 0;
  const isSorted = sortBy.length > 0;

  const groupByOptions = flatHeaders
    .filter((column) => column.canGroupBy)
    .map((column) => ({
      label: column.Header,
      value: column.id,
    }));

  const sortByOptions = flatHeaders
    .filter((column) => column.canSort)
    .map((column) => ({
      label: column.Header,
      value: column.id,
    }));

  const teamFilters = useMemo(() => {
    const sharingColumn = flatHeaders.find(
      (header) => header.id === "sharing.source.label"
    );
    return getFilterOptions(sharingColumn).filter(
      (option) => !["Personal", "Public"].includes(option as string)
    ) as string[];
  }, [flatHeaders]);

  const BlueprintsView = view === "list" ? TableView : GridView;

  return (
    <BootstrapRow>
      <ListFilters setAllFilters={setAllFilters} teamFilters={teamFilters} />
      <Col xs={9}>
        <div className="d-flex justify-content-between align-items-center">
          <h3 className="my-3">
            {filters.length > 0 ? filters[0].value : "All"} Blueprints
          </h3>
          <span className="d-flex align-items-center">
            <span className="ml-3 mr-2">Group by:</span>
            <Select
              isClearable
              placeholder="Group by"
              options={groupByOptions}
              onChange={(option, { action }) => {
                if (action === "clear") {
                  setGroupBy([]);
                  return;
                }

                setGroupBy([option.value]);
              }}
            />

            <span className="ml-3 mr-2">Sort by:</span>
            <Select
              isClearable
              placeholder="Sort by"
              options={sortByOptions}
              onChange={(option, { action }) => {
                if (action === "clear") {
                  setSortBy([]);
                  return;
                }

                setSortBy([{ id: option.value, desc: false }]);
              }}
            />

            {isSorted && (
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  setSortBy(
                    sortBy.map((sort) => {
                      sort.desc = !sort.desc;
                      return sort;
                    })
                  );
                }}
              >
                <FontAwesomeIcon
                  icon={
                    sortBy[0].desc ? faSortAmountUpAlt : faSortAmountDownAlt
                  }
                  size="lg"
                />
              </Button>
            )}
            <Button
              variant={view === "list" ? "link" : "outline-link"}
              size="sm"
              className="ml-3"
              onClick={() => {
                setView("list");
              }}
            >
              <FontAwesomeIcon icon={faList} size="lg" />
            </Button>
            <Button
              variant={view === "grid" ? "link" : "outline-link"}
              size="sm"
              onClick={() => {
                setView("grid");
              }}
            >
              <FontAwesomeIcon icon={faThLarge} size="lg" />
            </Button>
          </span>
        </div>
        {isGrouped ? (
          <>
            {rows.map((row) => (
              <Fragment key={row.groupByVal}>
                <h5 className="text-muted mt-3">{row.groupByVal}</h5>
                <BlueprintsView
                  tableInstance={tableInstance}
                  rows={row.subRows}
                />
              </Fragment>
            ))}
          </>
        ) : (
          <BlueprintsView tableInstance={tableInstance} rows={rows} />
        )}
      </Col>
    </BootstrapRow>
  );
};

export default BlueprintsCard;
