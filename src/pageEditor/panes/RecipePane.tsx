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

import styles from "./RecipePane.module.scss";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectActiveRecipeId } from "@/pageEditor/slices/editorSelectors";
import { Alert } from "react-bootstrap";
import { RecipeDefinition } from "@/types/definitions";
import Centered from "@/pageEditor/components/Centered";
import EditorTabLayout, {
  ActionButton,
  TabItem,
} from "@/components/tabLayout/EditorTabLayout";
import {
  faHistory,
  faQuestionCircle,
  faSave,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import AskQuestionModal from "@/pageEditor/askQuestion/AskQuestionModal";
import useRecipeSaver from "@/pageEditor/panes/save/useRecipeSaver";
import useRemoveRecipe from "@/pageEditor/hooks/useRemoveRecipe";
import Logs from "@/pageEditor/tabs/Logs";
import EditRecipe from "@/pageEditor/tabs/editRecipeTab/EditRecipe";
import { MessageContext } from "@/core";
import { logActions } from "@/components/logViewer/logSlice";
import useLogsBadgeState from "@/pageEditor/tabs/logs/useLogsBadgeState";
import RecipeOptions from "@/pageEditor/tabs/RecipeOptions";
import { useGetRecipesQuery } from "@/services/api";
import { useModals } from "@/components/ConfirmationModal";
import { actions } from "@/pageEditor/slices/editorSlice";

const EDIT_TAB_NAME = "Edit";

const RecipePane: React.FC<{ recipe: RecipeDefinition }> = () => {
  const { data: recipes } = useGetRecipesQuery();
  const activeRecipeId = useSelector(selectActiveRecipeId);
  const recipe = recipes.find(
    (recipe) => recipe.metadata.id === activeRecipeId
  );

  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [layoutKey, setLayoutKey] = useState(1);
  const resetLayout = useCallback(() => {
    setLayoutKey(layoutKey * -1);
  }, [layoutKey]);
  const [defaultTabName, setDefaultTabName] = useState(EDIT_TAB_NAME);

  const { save: saveRecipe, isSaving: isSavingRecipe } = useRecipeSaver();
  const { showConfirmation } = useModals();
  const dispatch = useDispatch();
  const resetRecipe = useCallback(async () => {
    const confirmed = await showConfirmation({
      title: "Reset Blueprint?",
      message:
        "Unsaved changes to extensions within this blueprint, or to blueprint options, will be lost",
      submitCaption: "Reset",
    });
    if (!confirmed) {
      return;
    }

    dispatch(actions.resetRecipeOptions(recipe.metadata.id));
    resetLayout();
  }, [dispatch, recipe.metadata.id, resetLayout, showConfirmation]);
  const removeRecipe = useRemoveRecipe();

  useEffect(() => {
    const messageContext: MessageContext = {
      blueprintId: recipe.metadata.id,
    };
    dispatch(logActions.setContext(messageContext));
  }, [dispatch, recipe.metadata.id]);

  const [unreadLogsCount, logsBadgeVariant] = useLogsBadgeState();

  const tabItems: TabItem[] = [
    {
      tabName: EDIT_TAB_NAME,
      TabContent: EditRecipe,
    },
    {
      tabName: "Blueprint Options",
      TabContent: RecipeOptions,
    },
    {
      tabName: "Logs",
      badgeCount: unreadLogsCount,
      badgeVariant: logsBadgeVariant,
      TabContent: Logs,
      mountWhenActive: true,
    },
  ];

  const buttons = useMemo<ActionButton[]>(() => {
    const results: ActionButton[] = [];

    results.push(
      {
        // Ask a question
        variant: "info",
        onClick() {
          setShowQuestionModal(true);
        },
        caption: "Ask a question",
        icon: faQuestionCircle,
      },
      {
        // Save
        variant: "primary",
        onClick() {
          void saveRecipe(recipe);
        },
        caption: "Save",
        disabled: isSavingRecipe,
        icon: faSave,
      },
      {
        // Reset
        variant: "warning",
        onClick: resetRecipe,
        caption: "Reset",
        disabled: isSavingRecipe,
        icon: faHistory,
      },
      {
        // Remove
        variant: "danger",
        onClick() {
          removeRecipe(recipe);
        },
        caption: "Remove",
        icon: faTrash,
      }
    );

    return results;
  }, [isSavingRecipe, recipe, removeRecipe, resetRecipe, saveRecipe]);

  if (!recipe) {
    return (
      <Centered>
        <Alert variant="danger">Recipe not found</Alert>
      </Centered>
    );
  }

  return (
    <div className={styles.root}>
      <EditorTabLayout
        key={layoutKey}
        tabs={tabItems}
        actionButtons={buttons}
        defaultTabName={defaultTabName}
        onChangeTab={({ tabName }) => {
          setDefaultTabName(tabName);
        }}
      />
      <AskQuestionModal
        showModal={showQuestionModal}
        setShowModal={setShowQuestionModal}
      />
    </div>
  );
};

export default RecipePane;
