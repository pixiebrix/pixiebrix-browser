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

import { useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectDirtyRecipeOptions } from "@/pageEditor/slices/editorSelectors";
import {
  useGetEditablePackagesQuery,
  useUpdateRecipeMutation,
} from "@/services/api";
import { produce } from "immer";
import { isEmpty } from "lodash";
import notify from "@/utils/notify";
import { RecipeDefinition } from "@/types/definitions";
import { actions } from "@/pageEditor/slices/editorSlice";

function useRecipeSaver(): [
  (recipe: RecipeDefinition) => Promise<void>,
  boolean
] {
  const dispatch = useDispatch();
  const { data: editablePackages } = useGetEditablePackagesQuery();
  const [updateRecipe] = useUpdateRecipeMutation();
  const dirtyRecipeOptions = useSelector(selectDirtyRecipeOptions);

  const [isSaving, setIsSaving] = useState(false);

  /**
   * Save a recipe's options configuration
   */
  const saveRecipeOptions = useCallback(
    async (recipe: RecipeDefinition) => {
      if (recipe == null) {
        return;
      }

      const newOptions = dirtyRecipeOptions[recipe.metadata.id];
      if (newOptions == null) {
        return;
      }

      setIsSaving(true);

      const newRecipe = produce<RecipeDefinition>(recipe, (draft) => {
        if (isEmpty(newOptions.schema?.properties)) {
          draft.options = undefined;
        } else {
          draft.options = newOptions;
        }
      });

      const packageId = editablePackages.find(
        // Bricks endpoint uses "name" instead of id
        (x) => x.name === newRecipe.metadata.id
      )?.id;

      const updateRecipeResponse = await updateRecipe({
        packageId,
        recipe: newRecipe,
      });

      if ("error" in updateRecipeResponse) {
        const errorMessage = "Failed to update the Blueprint";
        notify.error({
          message: errorMessage,
          error: updateRecipeResponse.error,
        });
      }

      setIsSaving(false);
      dispatch(actions.resetRecipeOptions(recipe.metadata.id));
    },
    [dirtyRecipeOptions, dispatch, editablePackages, updateRecipe]
  );

  return [saveRecipeOptions, isSaving];
}

export default useRecipeSaver;
