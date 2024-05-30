/*
 * Copyright (C) 2024 PixieBrix, Inc.
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
import SaveButton from "@/pageEditor/sidebar/SaveButton";
import {
  faClone,
  faFileExport,
  faFileImport,
  faHistory,
  faTimes,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "./ActionMenu.module.scss";
import EllipsisMenu, {
  type EllipsisMenuItem,
} from "@/components/ellipsisMenu/EllipsisMenu";

type ActionMenuProps = {
  labelRoot?: string;
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
  onDeactivate?: () => Promise<void>;
  onClone: () => Promise<void>;
  onReset?: () => Promise<void>;
  isDirty?: boolean;
  onAddToRecipe?: () => Promise<void>;
  onRemoveFromRecipe?: () => Promise<void>;
  disabled?: boolean;
};

const ActionMenu: React.FC<ActionMenuProps> = ({
  labelRoot,
  onSave,
  onDelete,
  onDeactivate,
  onClone,
  onReset,
  isDirty,
  onAddToRecipe,
  onRemoveFromRecipe,
  disabled,
}) => {
  const menuItems: EllipsisMenuItem[] = [
    onReset && {
      title: "Reset",
      icon: <FontAwesomeIcon icon={faHistory} fixedWidth />,
      action: onReset,
      disabled: !isDirty || disabled,
    },
    onAddToRecipe && {
      title: "Add to mod",
      icon: (
        <FontAwesomeIcon
          icon={faFileImport}
          fixedWidth
          className={styles.addIcon}
        />
      ),
      action: onAddToRecipe,
      disabled,
    },
    onRemoveFromRecipe && {
      title: "Move from mod",
      icon: (
        <FontAwesomeIcon
          icon={faFileExport}
          fixedWidth
          className={styles.removeIcon}
        />
      ),
      action: onRemoveFromRecipe,
      disabled,
    },
    {
      title: "Make a copy",
      icon: <FontAwesomeIcon icon={faClone} fixedWidth />,
      action: onClone,
      disabled,
    },
    onDelete && {
      title: "Delete",
      icon: <FontAwesomeIcon icon={faTrash} fixedWidth />,
      action: onDelete,
      disabled,
    },
    onDeactivate && {
      title: "Deactivate",
      icon: <FontAwesomeIcon icon={faTimes} fixedWidth />,
      action: onDeactivate,
      disabled,
    },
  ].filter(Boolean);

  return (
    <div className={styles.root}>
      <SaveButton
        ariaLabel={labelRoot ? `${labelRoot} - Save` : undefined}
        onClick={onSave}
        disabled={!isDirty || disabled}
      />
      <EllipsisMenu
        ariaLabel={labelRoot ? `${labelRoot} - Ellipsis` : undefined}
        items={menuItems}
        toggleClassName={styles.toggle}
      />
    </div>
  );
};

export default ActionMenu;
