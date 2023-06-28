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

import styles from "@/sidebar/homePanel/ActiveModListItem.module.scss";

import React from "react";
import { type ModViewItem } from "@/types/modTypes";
import { Button, ListGroup } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faExclamationCircle,
  faStore,
} from "@fortawesome/free-solid-svg-icons";
import { getContainedStarterBrickNames } from "@/utils/modUtils";
import useAsyncState from "@/hooks/useAsyncState";
import ModIcon from "@/mods/ModIcon";
import EllipsisMenu from "@/components/ellipsisMenu/EllipsisMenu";
import useMarketplaceUrl from "@/mods/hooks/useMarketplaceUrl";
import useRequestPermissionsAction from "@/mods/hooks/useRequestPermissionsAction";
import cx from "classnames";
import useReportError from "@/hooks/useReportError";

export const ActiveModListItem: React.FunctionComponent<{
  modViewItem: ModViewItem;
}> = ({ modViewItem }) => {
  const { name, mod } = modViewItem;
  const marketplaceListingUrl = useMarketplaceUrl(modViewItem);
  const requestPermissions = useRequestPermissionsAction(modViewItem);

  const { data: starterBricksContained = [], error } = useAsyncState(
    async () => getContainedStarterBrickNames(modViewItem),
    [],
    { initialValue: [] }
  );

  useReportError(error);

  return (
    <ListGroup.Item className={styles.root}>
      <div className={styles.mainContent}>
        <div className={styles.icon}>
          <ModIcon mod={mod} />
        </div>
        <div>
          <div>
            <h5 className={styles.lineClampOneLine}>{name}</h5>
            <span
              className={cx(
                styles.starterBricksList,
                requestPermissions
                  ? styles.lineClampOneLine
                  : styles.lineClampTwoLines
              )}
            >
              {starterBricksContained.join(" • ")}
            </span>
          </div>
          {requestPermissions && (
            <Button
              variant="link"
              size="sm"
              className={styles.warningLink}
              onClick={requestPermissions}
            >
              <FontAwesomeIcon icon={faExclamationCircle} /> Grant Permissions
            </Button>
          )}
        </div>
      </div>
      <div className="flex-shrink-1">
        <EllipsisMenu
          items={[
            {
              title: (
                <>
                  <FontAwesomeIcon fixedWidth icon={faStore} /> View Mod Details
                </>
              ),
              href: marketplaceListingUrl,
              disabled: !marketplaceListingUrl,
            },
          ]}
        />
      </div>
    </ListGroup.Item>
  );
};

export default ActiveModListItem;
