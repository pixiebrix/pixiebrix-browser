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
import { Table } from "react-bootstrap";
import type { LogEntry } from "@/telemetry/logging";
import EntryRow from "@/components/logViewer/EntryRow";
import styles from "./LogTable.module.scss";

const LogTable: React.FunctionComponent<{
  pageEntries: LogEntry[];
  hasEntries: boolean;
}> = ({ pageEntries, hasEntries }) => (
  <Table responsive>
    <thead className={styles.tableHead}>
      <tr>
        <th>&nbsp;</th>
        <th>Timestamp</th>
        <th>Level</th>
        <th>Label</th>
        <th>Block/Service</th>
        <th>Message/Error</th>
      </tr>
    </thead>
    <tbody>
      {pageEntries.map((entry) => (
        <EntryRow entry={entry} key={entry.uuid} />
      ))}
      {pageEntries.length === 0 && (
        <tr>
          <td>&nbsp;</td>
          <td colSpan={5}>
            {hasEntries ? (
              <span>There are no log entries at this log level</span>
            ) : (
              <span>No log entries</span>
            )}
          </td>
        </tr>
      )}
    </tbody>
  </Table>
);

export default LogTable;
