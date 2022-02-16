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

import styles from "./TableRow.module.scss";

import React from "react";
import SharingLabel from "@/options/pages/blueprints/SharingLabel";
import BlueprintActions from "@/options/pages/blueprints/BlueprintActions";
import { timeSince } from "@/utils/timeUtils";
import { InstallableViewItem } from "@/options/pages/blueprints/blueprintsTypes";
import Status from "@/options/pages/blueprints/Status";

const TableRow: React.VoidFunctionComponent<{
  installableItem: InstallableViewItem;
}> = ({ installableItem }) => {
  const { name, description, sharing, updatedAt, icon } = installableItem;

  return (
    <tr>
      <td>{icon}</td>
      <td className="text-wrap">
        <h5 className="text-wrap m-0">{name}</h5>
        <span className="text-muted text-wrap">{description}</span>
      </td>
      <td>
        <div className={styles.sharing}>
          <span className="small text-wrap">
            Updated: {timeSince(updatedAt)}
          </span>
          <SharingLabel sharing={sharing.source} />
        </div>
      </td>
      <td>
        <Status installableViewItem={installableItem} />
      </td>
      <td>
        <BlueprintActions installableViewItem={installableItem} />
      </td>
    </tr>
  );
};

export default TableRow;
