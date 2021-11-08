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

import React, { useContext, useRef, useState } from "react";
import {
  useCreateRecipeMutation,
  useUpdateRecipeMutation,
  useGetRecipesQuery,
  useGetEditablePackagesQuery,
} from "@/services/api";
import { uuidv4, validateRegistryId } from "@/types/helpers";
import { useCreate } from "@/devTools/editor/hooks/useCreate";
import { OnSubmit } from "@/components/form/Form";
import { Metadata } from "@/core";
import { useFormikContext } from "formik";
import SavingInProgressModal from "./SavingInProgressModal";
import LoadingDataModal from "./LoadingDataModal";
import {
  actions as editorActions,
  FormState,
} from "@/devTools/editor/slices/editorSlice";
import { useDispatch, useSelector } from "react-redux";
import useReset from "@/devTools/editor/hooks/useReset";
import { actions as savingExtensionActions } from "@/devTools/editor/panes/save/savingExtensionSlice";
import { actions as optionsActions } from "@/options/slices";
import { selectExtensions } from "@/options/selectors";
import AuthContext from "@/auth/AuthContext";
import {
  generateScopeBrickId,
  isRecipeEditable,
  replaceRecipeExtension,
} from "./saveHelpers";
import { selectElements } from "@/devTools/editor/slices/editorSelectors";
import { RecipeDefinition } from "@/types/definitions";
import useSavingWizard from "./useSavingWizard";
import SavingExtensionModal from "./SavingExtensionModal";
import RecipeConfigurationModal, {
  RecipeConfiguration,
} from "./RecipeConfigurationModal";

const SaveExtensionWizard: React.FC = () => {
  const dispatch = useDispatch();
  const { savingExtensionId, closeWizard } = useSavingWizard();
  const create = useCreate();
  const { scope } = useContext(AuthContext);
  const { data: recipes, isLoading: areRecipesLoading } = useGetRecipesQuery();
  const {
    data: editablePackages,
    isLoading: areEditablePackageLoading,
  } = useGetEditablePackagesQuery();
  const [createRecipe] = useCreateRecipeMutation();
  const [updateRecipe] = useUpdateRecipeMutation();
  const [
    isRecipeConfigurationModalShown,
    setRecipeOptionsModalShown,
  ] = useState(false);
  const isNewRecipe = useRef(false);
  const newRecipeInitialValues = useRef<RecipeConfiguration>(null);
  const { values: element } = useFormikContext<FormState>();
  const reset = useReset();

  const extensions = useSelector(selectExtensions);
  const elements = useSelector(selectElements);

  const close = (errorMessage?: string) => {
    closeWizard(errorMessage);
  };

  const save = (element: FormState) => {
    void create(element, close);
  };

  if (!element.recipe || savingExtensionId) {
    return <SavingInProgressModal />;
  }

  if (areRecipesLoading || areEditablePackageLoading) {
    return <LoadingDataModal onClose={close} />;
  }

  const elementRecipeMeta = element.recipe;
  const recipe = recipes.find((x) => x.metadata.id === elementRecipeMeta.id);

  /**
   * Creating personal extension from the existing one
   * It will not be a part of the Recipe
   */
  const saveAsPersonalExtension = () => {
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
    save(personalElement);
  };

  const showCreateRecipeModal = () => {
    isNewRecipe.current = true;
    const newRecipeId = generateScopeBrickId(scope, recipe.metadata.id);
    newRecipeInitialValues.current = {
      id: validateRegistryId(newRecipeId),
      name: `Copy of ${elementRecipeMeta.name}`,
      version: elementRecipeMeta.version,
      description: elementRecipeMeta.description,
    };

    setRecipeOptionsModalShown(true);
  };

  const showUpdateRecipeModal = () => {
    isNewRecipe.current = false;
    newRecipeInitialValues.current = elementRecipeMeta;

    setRecipeOptionsModalShown(true);
  };

  const saveRecipeAndExtension: OnSubmit<RecipeConfiguration> = async (
    recipeMeta
  ) => {
    dispatch(savingExtensionActions.setSavingExtension(element.uuid));

    const recipeExtensions = extensions.filter(
      (x) => x._recipe?.id === recipe.metadata.id
    );
    const recipeElements = elements.filter(
      (x) => x.recipe?.id === recipe.metadata.id
    );

    let newRecipe: RecipeDefinition;

    if (isNewRecipe.current) {
      const newRecipeId =
        recipeMeta.id === recipe.metadata.id
          ? recipeMeta.id + "_copy"
          : recipeMeta.id;

      const newMeta: Metadata = {
        ...recipeMeta,
        id: validateRegistryId(newRecipeId),
      };

      newRecipe = replaceRecipeExtension(recipe, newMeta, extensions, element);

      await createRecipe({
        recipe: newRecipe,
        organizations: [],
        public: false,
      });
    } else {
      newRecipe = replaceRecipeExtension(
        recipe,
        recipeMeta,
        extensions,
        element
      );

      const packageId = editablePackages.find(
        // Bricks endpoint uses "name" instead of id
        (x) => x.name === newRecipe.metadata.id
      )?.id;

      await updateRecipe({
        packageId,
        recipe: newRecipe,
      });
    }

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

    save(element);
  };

  return isRecipeConfigurationModalShown ? (
    <RecipeConfigurationModal
      initialValues={newRecipeInitialValues.current}
      isNewRecipe={isNewRecipe.current}
      navigateBack={() => {
        setRecipeOptionsModalShown(false);
      }}
      save={saveRecipeAndExtension}
    />
  ) : (
    <SavingExtensionModal
      recipeName={elementRecipeMeta.name}
      installedRecipeVersion={elementRecipeMeta.version}
      latestRecipeVersion={recipe.metadata.version}
      isRecipeEditable={isRecipeEditable(editablePackages, recipe)}
      saveAsPersonalExtension={saveAsPersonalExtension}
      showCreateRecipeModal={showCreateRecipeModal}
      showUpdateRecipeModal={showUpdateRecipeModal}
    />
  );
};

export default SaveExtensionWizard;
