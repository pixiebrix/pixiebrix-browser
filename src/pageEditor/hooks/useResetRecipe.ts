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

import { useCallback } from "react";
import { type RegistryId } from "@/types/registryTypes";
import { actions } from "@/pageEditor/slices/editorSlice";
import { useModals } from "@/components/ConfirmationModal";
import { useDispatch, useSelector } from "react-redux";
import useResetExtension from "@/pageEditor/hooks/useResetExtension";
import { selectModComponentFormStates } from "@/pageEditor/slices/editorSelectors";

function useResetRecipe(): (recipeId: RegistryId) => Promise<void> {
  const { showConfirmation } = useModals();
  const dispatch = useDispatch();
  const resetExtension = useResetExtension();
  const elements = useSelector(selectModComponentFormStates);

  return useCallback(
    async (recipeId: RegistryId) => {
      const confirmed = await showConfirmation({
        title: "Reset Mod?",
        message:
          "Unsaved changes to this mod, or to mod options and metadata, will be lost.",
        submitCaption: "Reset",
      });
      if (!confirmed) {
        return;
      }

      await Promise.all(
        elements
          .filter((element) => element.recipe?.id === recipeId)
          .map(async (element) =>
            resetExtension({
              extensionId: element.uuid,
              shouldShowConfirmation: false,
            }),
          ),
      );

      dispatch(actions.resetMetadataAndOptionsForRecipe(recipeId));
      dispatch(actions.restoreDeletedElementsForRecipe(recipeId));
      dispatch(actions.selectRecipeId(recipeId));
    },
    [dispatch, elements, resetExtension, showConfirmation],
  );
}

export default useResetRecipe;
