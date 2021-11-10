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

import { actions as savingExtensionActions } from "./savingExtensionSlice";
import { useDispatch, useSelector } from "react-redux";
import {
  selectIsWizardOpen,
  selectSavingExtensionId,
} from "./savingExtensionSelectors";
import {
  selectActiveElement,
  selectElements,
} from "@/devTools/editor/slices/editorSelectors";
import useCreate from "@/devTools/editor/hooks/useCreate";
import Deferred from "@/utils/deferred";
import {
  actions as editorActions,
  FormState,
} from "@/devTools/editor/slices/editorSlice";
import { uuidv4, validateRegistryId } from "@/types/helpers";
import useReset from "@/devTools/editor/hooks/useReset";
import { RegistryId, Metadata } from "@/core";
import { RecipeDefinition } from "@/types/definitions";
import useNotifications from "@/hooks/useNotifications";
import { selectExtensions } from "@/options/selectors";
import {
  useCreateRecipeMutation,
  useGetEditablePackagesQuery,
  useGetRecipesQuery,
  useUpdateRecipeMutation,
} from "@/services/api";
import { replaceRecipeExtension } from "./saveHelpers";
import { actions as optionsActions } from "@/options/slices";

export type RecipeConfiguration = {
  id: RegistryId;
  name: string;
  version?: string;
  description?: string;
};

let savingDeferred: Deferred;

const useSavingWizard = () => {
  const dispatch = useDispatch();
  const create = useCreate();
  const reset = useReset();
  const notify = useNotifications();
  const isWizardOpen = useSelector(selectIsWizardOpen);
  const savingExtensionId = useSelector(selectSavingExtensionId);
  const extensions = useSelector(selectExtensions);
  const elements = useSelector(selectElements);
  const element = useSelector(selectActiveElement);

  const { data: recipes } = useGetRecipesQuery();
  const { data: editablePackages } = useGetEditablePackagesQuery();
  const [createRecipe] = useCreateRecipeMutation();
  const [updateRecipe] = useUpdateRecipeMutation();

  const save = async () => {
    if (!element.recipe) {
      saveNonRecipeElement();
    }

    savingDeferred = new Deferred();

    dispatch(savingExtensionActions.openWizard());
    return savingDeferred.promise;
  };

  /**
   * Saves an extension that is not a part of a Recipe
   */
  const saveNonRecipeElement = () => {
    dispatch(savingExtensionActions.setSavingExtension(element.uuid));
    void create(element, closeWizard);
  };

  /**
   * Creates personal extension from the existing one
   * It will not be a part of the Recipe
   */
  const saveElementAsPersonalExtension = () => {
    const newExtensionUuid = uuidv4();
    dispatch(savingExtensionActions.setSavingExtension(newExtensionUuid));

    const { recipe, ...rest } = element;
    const personalElement: FormState = {
      ...rest,
      uuid: newExtensionUuid,
      // Detach from the recipe
      recipe: undefined,
    };

    dispatch(editorActions.addElement(personalElement));
    reset({ element, shouldShowConfirmation: false });
    void create(personalElement, closeWizard);
  };

  /**
   * Creates new recipe,
   * updates all extensions of the old recipe to pont to the new one,
   * and saves the changes of the element.
   */
  const saveElementAndCreateNewRecipe = async (
    recipeMeta: RecipeConfiguration
  ) => {
    dispatch(savingExtensionActions.setSavingExtension(element.uuid));

    const elementRecipeMeta = element.recipe;
    const recipe = recipes.find((x) => x.metadata.id === elementRecipeMeta.id);

    const newRecipeId =
      recipeMeta.id === recipe.metadata.id
        ? recipeMeta.id + "_copy"
        : recipeMeta.id;

    const newMeta: Metadata = {
      ...recipeMeta,
      id: validateRegistryId(newRecipeId),
    };

    const newRecipe = replaceRecipeExtension(
      recipe,
      newMeta,
      extensions,
      element
    );

    const createResult = await createRecipe({
      recipe: newRecipe,
      organizations: [],
      public: false,
    });

    if ("error" in createResult) {
      const errorMessage = "Failed to create new Blueprint";
      notify.error(errorMessage, {
        error: createResult.error,
      });
      closeWizard(errorMessage);
      return;
    }

    void updateRecipeExtensions(recipe.metadata.id, newRecipe);
  };

  /**
   * Updates new recipe,
   * updates all extensions of the recipe with the new metadata,
   * and saves the changes of the element.
   */
  const saveElementAndUpdateRecipe = async (
    recipeMeta: RecipeConfiguration
  ) => {
    dispatch(savingExtensionActions.setSavingExtension(element.uuid));

    const elementRecipeMeta = element.recipe;
    const recipe = recipes.find((x) => x.metadata.id === elementRecipeMeta.id);

    const newRecipe = replaceRecipeExtension(
      recipe,
      recipeMeta,
      extensions,
      element
    );

    const packageId = editablePackages.find(
      // Bricks endpoint uses "name" instead of id
      (x) => x.name === newRecipe.metadata.id
    )?.id;

    const updateResult = await updateRecipe({
      packageId,
      recipe: newRecipe,
    });

    if ("error" in updateResult) {
      const errorMessage = "Failed to update the Blueprint";
      notify.error(errorMessage, {
        error: updateResult.error,
      });
      closeWizard(errorMessage);
      return;
    }

    void updateRecipeExtensions(recipe.metadata.id, newRecipe);
  };

  const updateRecipeExtensions = async (
    sourceRecipeId: RegistryId,
    newRecipe: RecipeDefinition
  ) => {
    const recipeExtensions = extensions.filter(
      (x) => x._recipe?.id === sourceRecipeId
    );
    const recipeElements = elements.filter(
      (x) => x.recipe?.id === sourceRecipeId
    );

    for (const recipeExtension of recipeExtensions) {
      const update = {
        id: recipeExtension.id,
        _recipe: newRecipe.metadata,
      };

      dispatch(optionsActions.updateExtension(update));
    }

    for (const recipeElement of recipeElements) {
      const elementUpdate = {
        uuid: recipeElement.uuid,
        recipe: newRecipe.metadata,
      };

      dispatch(editorActions.updateElement(elementUpdate));
    }

    void create(element, closeWizard);
  };

  const closeWizard = (errorMessage?: string | null) => {
    dispatch(savingExtensionActions.closeWizard());

    if (savingDeferred) {
      if (errorMessage) {
        savingDeferred.reject(errorMessage);
      } else {
        savingDeferred.resolve();
      }

      savingDeferred = null;
    }
  };

  return {
    isWizardOpen,
    savingExtensionId,
    element,
    save,
    saveElementAsPersonalExtension,
    saveElementAndCreateNewRecipe,
    saveElementAndUpdateRecipe,
    closeWizard,
  };
};

export default useSavingWizard;
