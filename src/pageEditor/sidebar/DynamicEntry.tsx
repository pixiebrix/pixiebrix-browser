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

import styles from "./Entry.module.scss";
import React, { useCallback } from "react";
import { actions } from "@/pageEditor/slices/editorSlice";
import { useDispatch, useSelector } from "react-redux";
import { ListGroup } from "react-bootstrap";
import { getLabel } from "@/pageEditor/sidebar/common";
import {
  ExtensionIcon,
  NotAvailableIcon,
  UnsavedChangesIcon,
} from "@/pageEditor/sidebar/ExtensionIcons";
import { UUID } from "@/core";
import {
  disableOverlay,
  enableOverlay,
  showSidebar,
} from "@/contentScript/messenger/api";
import { thisTab } from "@/pageEditor/utils";
import cx from "classnames";
import { reportEvent } from "@/telemetry/events";
import { selectSessionId } from "@/pageEditor/slices/sessionSelectors";
import { FormState } from "@/pageEditor/extensionPoints/formStateTypes";
import {
  selectActiveElement,
  selectActiveRecipeId,
  selectElementIsDirty,
} from "@/pageEditor/slices/editorSelectors";
import ActionMenu from "@/components/sidebar/ActionMenu";

type DynamicEntryProps = {
  item: FormState;
  isAvailable: boolean;
  isActive: boolean;
  isNested?: boolean;
  onSave: () => Promise<void>;
  isSaving: boolean;
  onReset: () => Promise<void>;
  onRemove: () => Promise<void>;
};

/**
 * A sidebar menu entry corresponding to an extension that is new or is currently being edited.
 * @see InstalledEntry
 */
const DynamicEntry: React.FunctionComponent<DynamicEntryProps> = ({
  item,
  isAvailable,
  isActive,
  isNested = false,
  onSave,
  isSaving,
  onReset,
  onRemove,
}) => {
  const dispatch = useDispatch();
  const sessionId = useSelector(selectSessionId);
  const activeRecipeId = useSelector(selectActiveRecipeId);
  const activeElement = useSelector(selectActiveElement);
  // Get the selected recipe id, or the recipe id of the selected item
  const recipeId = activeRecipeId ?? activeElement?.recipe?.id;
  // Set the alternate background if this item isn't active, but either its recipe or another item in its recipe is active
  const hasRecipeBackground =
    !isActive && recipeId && item.recipe?.id === recipeId;
  const isDirty = useSelector(selectElementIsDirty(item.uuid));

  const isButton = item.type === "menuItem";

  const showOverlay = useCallback(async (uuid: UUID) => {
    await enableOverlay(thisTab, `[data-pb-uuid="${uuid}"]`);
  }, []);

  const hideOverlay = useCallback(async () => {
    await disableOverlay(thisTab);
  }, []);

  return (
    <ListGroup.Item
      className={cx(styles.root, {
        [styles.recipeBackground]: hasRecipeBackground,
      })}
      as="div"
      active={isActive}
      key={`dynamic-${item.uuid}`}
      onMouseEnter={isButton ? async () => showOverlay(item.uuid) : undefined}
      onMouseLeave={isButton ? async () => hideOverlay() : undefined}
      onClick={() => {
        reportEvent("PageEditorOpen", {
          sessionId,
          extensionId: item.uuid,
        });

        dispatch(actions.selectElement(item.uuid));

        if (item.type === "actionPanel") {
          // Switch the sidepanel over to the panel. However, don't refresh because the user might be switching
          // frequently between extensions within the same blueprint.
          void showSidebar(thisTab, {
            extensionId: item.uuid,
            force: true,
            refresh: false,
          });
        }
      }}
    >
      <span
        className={cx(styles.icon, {
          [styles.nested]: isNested,
        })}
      >
        <ExtensionIcon type={item.type} />
      </span>
      <span className={styles.name}>{getLabel(item)}</span>
      {!isAvailable && (
        <span className={styles.icon}>
          <NotAvailableIcon />
        </span>
      )}
      {isDirty && !isActive && (
        <span className={cx(styles.icon, styles.unsaved, "text-danger")}>
          <UnsavedChangesIcon />
        </span>
      )}
      {isActive && (
        <ActionMenu
          onSave={onSave}
          onRemove={onRemove}
          onReset={item.installed ? onReset : undefined}
          isDirty={isDirty}
          onAddToRecipe={
            item.recipe
              ? undefined
              : async () => {
                  dispatch(actions.showAddToRecipeModal());
                }
          }
          onRemoveFromRecipe={
            item.recipe
              ? async () => {
                  dispatch(actions.showRemoveFromRecipeModal());
                }
              : undefined
          }
          disabled={isSaving}
        />
      )}
    </ListGroup.Item>
  );
};

export default DynamicEntry;
