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
import { type UUID } from "@/types/stringTypes";
import {
  disableOverlay,
  enableOverlay,
  updateSidebar,
} from "@/contentScript/messenger/api";
import { openSidePanel } from "@/utils/sidePanelUtils";
import cx from "classnames";
import reportEvent from "@/telemetry/reportEvent";
import { Events } from "@/telemetry/events";
import { selectSessionId } from "@/pageEditor/slices/sessionSelectors";
import { type ModComponentFormState } from "@/pageEditor/starterBricks/formStateTypes";
import {
  selectActiveModComponentFormState,
  selectActiveModId,
  selectModComponentIsDirty,
} from "@/pageEditor/slices/editorSelectors";
import ActionMenu from "@/pageEditor/sidebar/ActionMenu";
import useSaveStandaloneModComponent from "@/pageEditor/hooks/useSaveStandaloneModComponent";
import useResetExtension from "@/pageEditor/hooks/useResetExtension";
import {
  useRemoveModComponentFromStorage,
  DEACTIVATE_MOD_MODAL_PROPS,
  DELETE_STANDALONE_MOD_COMPONENT_MODAL_PROPS,
  DELETE_STARTER_BRICK_MODAL_PROPS,
} from "@/pageEditor/hooks/useRemoveModComponentFromStorage";
import useSaveMod from "@/pageEditor/hooks/useSaveMod";
import { selectIsModComponentSavedOnCloud } from "@/store/extensionsSelectors";
import { inspectedTab } from "@/pageEditor/context/connection";

type DraftModComponentListItemProps = {
  modComponentFormState: ModComponentFormState;
  isAvailable: boolean;
  isNested?: boolean;
};

/**
 * A sidebar menu entry corresponding to a touched mod component
 * @see ActivatedModComponentListItem
 * @see ModComponentListItem
 */
const DraftModComponentListItem: React.FunctionComponent<
  DraftModComponentListItemProps
> = ({ modComponentFormState, isAvailable, isNested = false }) => {
  const dispatch = useDispatch();
  const sessionId = useSelector(selectSessionId);
  const activeModId = useSelector(selectActiveModId);
  const activeModComponentFormState = useSelector(
    selectActiveModComponentFormState,
  );

  const isActive =
    activeModComponentFormState?.uuid === modComponentFormState.uuid;
  const modId = modComponentFormState.recipe?.id;
  const isSiblingOfActiveListItem = activeModComponentFormState?.recipe?.id
    ? modId === activeModComponentFormState?.recipe?.id
    : false;
  const isChildOfActiveListItem = modId === activeModId;
  const isRelativeOfActiveListItem =
    !isActive && (isChildOfActiveListItem || isSiblingOfActiveListItem);
  const isDirty = useSelector(
    selectModComponentIsDirty(modComponentFormState.uuid),
  );
  const isSavedOnCloud = useSelector(
    selectIsModComponentSavedOnCloud(modComponentFormState.uuid),
  );
  const removeModComponentFromStorage = useRemoveModComponentFromStorage();
  const isButton = modComponentFormState.type === "menuItem";

  const showOverlay = useCallback(async (uuid: UUID) => {
    await enableOverlay(inspectedTab, `[data-pb-uuid="${uuid}"]`);
  }, []);

  const hideOverlay = useCallback(async () => {
    await disableOverlay(inspectedTab);
  }, []);

  const {
    save: saveStandaloneModComponent,
    isSaving: isSavingStandaloneModComponent,
  } = useSaveStandaloneModComponent();
  const resetExtension = useResetExtension();
  const { save: saveRecipe, isSaving: isSavingRecipe } = useSaveMod();

  const deleteModComponent = async () =>
    removeModComponentFromStorage({
      modComponentId: modComponentFormState.uuid,
      showConfirmationModal: modId
        ? DELETE_STARTER_BRICK_MODAL_PROPS
        : DELETE_STANDALONE_MOD_COMPONENT_MODAL_PROPS,
    });
  const deactivateModComponent = async () =>
    removeModComponentFromStorage({
      modComponentId: modComponentFormState.uuid,
      showConfirmationModal: DEACTIVATE_MOD_MODAL_PROPS,
    });

  const onSave = async () => {
    if (modComponentFormState.recipe) {
      await saveRecipe(modComponentFormState.recipe?.id);
    } else {
      await saveStandaloneModComponent(modComponentFormState);
    }
  };

  const isSaving = modComponentFormState.recipe
    ? isSavingRecipe
    : isSavingStandaloneModComponent;

  const onReset = async () =>
    resetExtension({ extensionId: modComponentFormState.uuid });

  const onDelete = modId || !isSavedOnCloud ? deleteModComponent : undefined;

  const onDeactivate = onDelete ? undefined : deactivateModComponent;

  const onClone = async () => {
    dispatch(actions.cloneActiveExtension());
  };

  return (
    <ListGroup.Item
      className={cx(styles.root, {
        [styles.recipeBackground ?? ""]: isRelativeOfActiveListItem,
      })}
      as="div"
      active={isActive}
      key={`draft-${modComponentFormState.uuid}`}
      onMouseEnter={
        isButton
          ? async () => showOverlay(modComponentFormState.uuid)
          : undefined
      }
      onMouseLeave={isButton ? async () => hideOverlay() : undefined}
      onClick={async () => {
        reportEvent(Events.PAGE_EDITOR_OPEN, {
          sessionId,
          extensionId: modComponentFormState.uuid,
        });

        dispatch(
          actions.makeModComponentFormStateActive(modComponentFormState.uuid),
        );

        if (modComponentFormState.type === "actionPanel") {
          // Switch the sidepanel over to the panel. However, don't refresh because the user might be switching
          // frequently between extensions within the same blueprint.
          await openSidePanel(inspectedTab.tabId);
          updateSidebar(inspectedTab, {
            extensionId: modComponentFormState.uuid,
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
        <ExtensionIcon type={modComponentFormState.type} />
      </span>
      <span className={styles.name}>{getLabel(modComponentFormState)}</span>
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
          labelRoot={`${getLabel(modComponentFormState)}`}
          onSave={onSave}
          onDelete={onDelete}
          onDeactivate={onDeactivate}
          onClone={onClone}
          onReset={modComponentFormState.installed ? onReset : undefined}
          isDirty={isDirty}
          onAddToRecipe={
            modComponentFormState.recipe
              ? undefined
              : async () => {
                  dispatch(actions.showAddToRecipeModal());
                }
          }
          onRemoveFromRecipe={
            modComponentFormState.recipe
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

export default DraftModComponentListItem;
