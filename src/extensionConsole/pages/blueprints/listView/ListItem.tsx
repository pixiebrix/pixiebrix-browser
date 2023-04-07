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

import styles from "./ListItem.module.scss";

import React from "react";
import SharingLabel from "@/extensionConsole/pages/blueprints/labels/SharingLabel";
import BlueprintActions from "@/extensionConsole/pages/blueprints/BlueprintActions";

import { type InstallableViewItem } from "@/extensionConsole/pages/blueprints/blueprintsTypes";
import Status from "@/extensionConsole/pages/blueprints/Status";
import { ListGroup } from "react-bootstrap";
import LastUpdatedLabel from "@/extensionConsole/pages/blueprints/labels/LastUpdatedLabel";

const ListItem: React.VoidFunctionComponent<{
  installableItem: InstallableViewItem;
  style: React.CSSProperties;
}> = ({ installableItem, style }) => {
  const { name, sharing, updatedAt, icon, description } = installableItem;

  return (
    <ListGroup.Item className={styles.root} style={style}>
      <div className={styles.icon}>{icon}</div>
      <div className={styles.primaryInfo}>
        <h5 className={styles.name}>{name}</h5>
        <p className={styles.description}>{description}</p>
        <div className={styles.packageId}>{sharing.packageId}</div>
      </div>
      <div className="flex-shrink-0">
        <div className={styles.sharing}>
          <SharingLabel
            sharing={sharing.source}
            className={styles.sharingLabel}
          />
          <span>
            <LastUpdatedLabel timestamp={updatedAt} />
          </span>
        </div>
      </div>
      <div className={styles.status}>
        <Status installableViewItem={installableItem} />
      </div>
      <div className="flex-shrink-0">
        <BlueprintActions installableViewItem={installableItem} />
      </div>
    </ListGroup.Item>
  );
};

export default React.memo(ListItem);
