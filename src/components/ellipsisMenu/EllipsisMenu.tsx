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

import React, { ReactNode } from "react";
import { Dropdown } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEllipsisV } from "@fortawesome/free-solid-svg-icons";
import styles from "./EllipsisMenu.module.scss";

type Item = {
  title: ReactNode;
  action: () => void;
  className?: string;
};

const EllipsisMenu: React.FunctionComponent<{
  variant?: string;
  items: Item[];
}> = ({ variant, items }) => (
  <Dropdown alignRight>
    <Dropdown.Toggle
      className={styles.toggle}
      variant={variant ?? "light"}
      size="sm"
    >
      <FontAwesomeIcon icon={faEllipsisV} />
    </Dropdown.Toggle>

    <Dropdown.Menu>
      {items.map((item, index) => (
        <Dropdown.Item
          key={index}
          onClick={(event) => {
            // FIXME: unsucessfully trying to prevent the RecipeEntry row toggle click handler...
            event.stopPropagation();
            event.preventDefault();
            item.action();
          }}
          className={item.className}
        >
          {item.title}
        </Dropdown.Item>
      ))}
    </Dropdown.Menu>
  </Dropdown>
);

export default EllipsisMenu;
