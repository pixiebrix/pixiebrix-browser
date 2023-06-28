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
import SharingLabel from "@/extensionConsole/pages/mods/labels/SharingLabel";
import ModsPageActions from "@/extensionConsole/pages/mods/ModsPageActions";

import { type ModViewItem } from "@/types/modTypes";
import Status from "@/extensionConsole/pages/mods/Status";
import { ListGroup } from "react-bootstrap";
import LastUpdatedLabel from "@/extensionConsole/pages/mods/labels/LastUpdatedLabel";
import ModIcon from "@/mods/ModIcon";

const ListItem: React.VoidFunctionComponent<{
  modViewItem: ModViewItem;
  style: React.CSSProperties;
}> = ({ modViewItem, style }) => {
  const { name, sharing, updatedAt, mod, description } = modViewItem;

  return (
    <ListGroup.Item className={styles.root} style={style}>
      <div className={styles.icon}>
        <ModIcon size="2x" mod={mod} />
      </div>
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
        <Status modViewItem={modViewItem} />
      </div>
      <div className="flex-shrink-0">
        <ModsPageActions modViewItem={modViewItem} />
      </div>
    </ListGroup.Item>
  );
};

export default React.memo(ListItem);
