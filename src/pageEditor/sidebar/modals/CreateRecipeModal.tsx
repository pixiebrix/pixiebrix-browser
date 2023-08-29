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

import React, { useCallback } from "react";
import {
  PACKAGE_REGEX,
  testIsSemVerString,
  uuidv4,
  validateRegistryId,
  validateSemVerString,
} from "@/types/helpers";
import { useDispatch, useSelector } from "react-redux";
import {
  selectActiveElement,
  selectActiveRecipeId,
  selectDeletedElements,
  selectDirty,
  selectDirtyMetadataForRecipeId,
  selectDirtyRecipeOptionDefinitions,
  selectEditorModalVisibilities,
  selectElements,
  selectKeepLocalCopyOnCreateRecipe,
  selectNewRecipeIds,
} from "@/pageEditor/slices/editorSelectors";
import { actions as editorActions } from "@/pageEditor/slices/editorSlice";
import { Button, Modal } from "react-bootstrap";
import { selectScope } from "@/auth/authSelectors";
import {
  buildRecipe,
  generateScopeBrickId,
} from "@/pageEditor/panes/save/saveHelpers";
import { RequireScope } from "@/auth/RequireScope";
import Form, {
  type OnSubmit,
  type RenderBody,
  type RenderSubmit,
} from "@/components/form/Form";
import { useCreateRecipeMutation } from "@/services/api";
import useUpsertFormElement from "@/pageEditor/hooks/useUpsertFormElement";
import extensionsSlice from "@/store/extensionsSlice";
import notify from "@/utils/notify";
import ConnectedFieldTemplate from "@/components/form/ConnectedFieldTemplate";
import { produce } from "immer";
import { object, string } from "yup";
import { type ModComponentFormState } from "@/pageEditor/starterBricks/formStateTypes";
import { selectExtensions } from "@/store/extensionsSelectors";
import {
  inferConfiguredModIntegrations,
  inferRecipeOptions,
} from "@/store/extensionsUtils";
import useRemoveExtension from "@/pageEditor/hooks/useRemoveExtension";
import useRemoveRecipe from "@/pageEditor/hooks/useRemoveRecipe";
import RegistryIdWidget from "@/components/form/widgets/RegistryIdWidget";
import { isSingleObjectBadRequestError } from "@/errors/networkErrorHelpers";
import { type PackageUpsertResponse } from "@/types/contract";
import { pick } from "lodash";
import {
  useAllModDefinitions,
  useOptionalModDefinition,
} from "@/modDefinitions/modDefinitionHooks";
import Loader from "@/components/Loader";
import ModalLayout from "@/components/ModalLayout";
import {
  type ModDefinition,
  type UnsavedModDefinition,
} from "@/types/modDefinitionTypes";
import { type ModMetadataFormState } from "@/pageEditor/pageEditorTypes";
import { type RegistryId } from "@/types/registryTypes";
import { type ModComponentBase } from "@/types/modComponentTypes";
import { ensureElementPermissionsFromUserGesture } from "@/pageEditor/editorPermissionsHelpers";
import { generatePackageId } from "@/utils/registryUtils";
import { FieldDescriptions } from "@/modDefinitions/modDefinitionConstants";

const { actions: optionsActions } = extensionsSlice;

function selectRecipeMetadata(
  unsavedRecipe: UnsavedModDefinition,
  response: PackageUpsertResponse
): ModComponentBase["_recipe"] {
  return {
    ...unsavedRecipe.metadata,
    sharing: pick(response, ["public", "organizations"]),
    ...pick(response, ["updated_at"]),
  };
}

function useSaveCallbacks({
  activeElement,
}: {
  activeElement: ModComponentFormState;
}) {
  const dispatch = useDispatch();
  const [createRecipe] = useCreateRecipeMutation();
  const createExtension = useUpsertFormElement();
  const removeExtension = useRemoveExtension();
  const removeRecipe = useRemoveRecipe();

  const editorFormElements = useSelector(selectElements);
  const isDirtyByElementId = useSelector(selectDirty);
  const installedExtensions = useSelector(selectExtensions);
  const dirtyRecipeOptions = useSelector(selectDirtyRecipeOptionDefinitions);
  const deletedElementsByRecipeId = useSelector(selectDeletedElements);
  const keepLocalCopy = useSelector(selectKeepLocalCopyOnCreateRecipe);

  const createRecipeFromElement = useCallback(
    // eslint-disable-next-line @typescript-eslint/promise-function-async -- permissions check must be called in the user gesture context, `async-await` can break the call chain
    (element: ModComponentFormState, metadata: ModMetadataFormState) =>
      // eslint-disable-next-line promise/prefer-await-to-then -- permissions check must be called in the user gesture context, `async-await` can break the call chain
      ensureElementPermissionsFromUserGesture(element).then(
        async (hasPermissions) => {
          if (!hasPermissions) {
            return;
          }

          let recipeElement = produce(activeElement, (draft) => {
            draft.uuid = uuidv4();
          });
          const newRecipe = buildRecipe({
            cleanRecipeExtensions: [],
            dirtyRecipeElements: [recipeElement],
            metadata,
          });
          const response = await createRecipe({
            recipe: newRecipe,
            organizations: [],
            public: false,
          }).unwrap();
          recipeElement = produce(recipeElement, (draft) => {
            draft.recipe = selectRecipeMetadata(newRecipe, response);
          });
          dispatch(editorActions.addElement(recipeElement));
          await createExtension({
            element: recipeElement,
            options: {
              // Don't push to cloud since we're saving it with the recipe
              pushToCloud: false,
              // Permissions are already checked above
              checkPermissions: false,
              // Need to provide user feedback
              notifySuccess: true,
              reactivateEveryTab: true,
            },
          });
          if (!keepLocalCopy) {
            await removeExtension({
              extensionId: activeElement.uuid,
              shouldShowConfirmation: false,
            });
          }
        }
      ),
    [
      activeElement,
      createExtension,
      createRecipe,
      dispatch,
      keepLocalCopy,
      removeExtension,
    ]
  );

  const createRecipeFromRecipe = useCallback(
    async (recipe: ModDefinition, metadata: ModMetadataFormState) => {
      const recipeId = recipe.metadata.id;
      // eslint-disable-next-line security/detect-object-injection -- recipeId
      const deletedElements = deletedElementsByRecipeId[recipeId] ?? [];
      const deletedElementIds = new Set(
        deletedElements.map(({ uuid }) => uuid)
      );

      const dirtyRecipeElements = editorFormElements.filter(
        (element) =>
          element.recipe?.id === recipeId &&
          isDirtyByElementId[element.uuid] &&
          !deletedElementIds.has(element.uuid)
      );
      const cleanRecipeExtensions = installedExtensions.filter(
        (extension) =>
          extension._recipe?.id === recipeId &&
          !dirtyRecipeElements.some(
            (element) => element.uuid === extension.id
          ) &&
          !deletedElementIds.has(extension.id)
      );
      // eslint-disable-next-line security/detect-object-injection -- new recipe IDs are sanitized in the form validation
      const options = dirtyRecipeOptions[recipeId];

      const newRecipe = buildRecipe({
        sourceRecipe: recipe,
        cleanRecipeExtensions,
        dirtyRecipeElements,
        options,
        metadata,
      });

      const response = await createRecipe({
        recipe: newRecipe,
        organizations: [],
        public: false,
      }).unwrap();

      const savedRecipe: ModDefinition = {
        ...newRecipe,
        sharing: {
          public: response.public,
          organizations: response.organizations,
        },
        updated_at: response.updated_at,
      };

      if (!keepLocalCopy) {
        await removeRecipe({ recipeId, shouldShowConfirmation: false });
      }

      dispatch(
        optionsActions.installMod({
          modDefinition: savedRecipe,
          configuredDependencies: inferConfiguredModIntegrations([
            ...dirtyRecipeElements,
            ...cleanRecipeExtensions,
          ]),
          optionsArgs: inferRecipeOptions([
            ...dirtyRecipeElements,
            ...cleanRecipeExtensions,
          ]),
          screen: "pageEditor",
          isReinstall: false,
        })
      );

      dispatch(
        editorActions.finishSaveAsNewRecipe({
          oldRecipeId: recipeId,
          newRecipeId: savedRecipe.metadata.id,
          metadata,
          options,
        })
      );
    },
    [
      createRecipe,
      deletedElementsByRecipeId,
      dirtyRecipeOptions,
      dispatch,
      editorFormElements,
      installedExtensions,
      isDirtyByElementId,
      keepLocalCopy,
      removeRecipe,
    ]
  );

  return {
    createRecipeFromElement,
    createRecipeFromRecipe,
  };
}

function useInitialFormState({
  activeRecipe,
  activeElement,
}: {
  activeElement: ModComponentFormState;
  activeRecipe: ModDefinition | null;
}): ModMetadataFormState | null {
  const scope = useSelector(selectScope);

  const activeRecipeId =
    activeElement?.recipe?.id ?? activeRecipe?.metadata?.id;
  const dirtyMetadata = useSelector(
    selectDirtyMetadataForRecipeId(activeRecipeId)
  );
  const recipeMetadata = dirtyMetadata ?? activeRecipe?.metadata;

  // Handle the "Save As New" case, where an existing recipe, or an
  // extension within an existing recipe, is selected
  if (recipeMetadata) {
    let newId = generateScopeBrickId(scope, recipeMetadata.id);
    if (newId === recipeMetadata.id) {
      newId = validateRegistryId(newId + "-copy");
    }

    return {
      id: newId,
      name: recipeMetadata.name,
      version: validateSemVerString("1.0.0"),
      description: recipeMetadata.description,
    };
  }

  // Handle creating a new blueprint from a selected extension
  if (activeElement) {
    return {
      id: generatePackageId(scope, activeElement.label),
      name: activeElement.label,
      version: validateSemVerString("1.0.0"),
      description: "Created with the PixieBrix Page Editor",
    };
  }

  return null;
}

function useFormSchema() {
  const newRecipeIds = useSelector(selectNewRecipeIds);
  const { data: recipes } = useAllModDefinitions();
  const savedRecipeIds: RegistryId[] = (recipes ?? []).map(
    (x) => x.metadata.id
  );
  const allRecipeIds = [...newRecipeIds, ...savedRecipeIds];

  // TODO: This should be yup.SchemaOf<RecipeMetadataFormState> but we can't set the `id` property to `RegistryId`
  // see: https://github.com/jquense/yup/issues/1183#issuecomment-749186432
  return object({
    id: string()
      .matches(
        PACKAGE_REGEX,
        "Mod ID is required, and may only include lowercase letters, numbers, and the symbols - _ ~"
      )
      .notOneOf(allRecipeIds, "Mod ID is already in use")
      .required("Mod ID is required"),
    name: string().required("Name is required"),
    version: string()
      .test(
        "semver",
        "Version must follow the X.Y.Z semantic version format, without a leading 'v'",
        (value: string) => testIsSemVerString(value, { allowLeadingV: false })
      )
      .required(),
    description: string(),
  });
}

const CreateRecipeModalBody: React.FC = () => {
  const dispatch = useDispatch();

  const activeElement = useSelector(selectActiveElement);

  // `selectActiveRecipeId` returns the recipe id _if the recipe element is selected_. Assumption: if the CreateModal
  // is open an extension element is active, then we're performing a "Save a New" on that recipe.
  const directlyActiveRecipeId = useSelector(selectActiveRecipeId);
  const activeRecipeId = directlyActiveRecipeId ?? activeElement?.recipe?.id;
  const { data: activeRecipe, isFetching: isRecipeFetching } =
    useOptionalModDefinition(activeRecipeId);

  const formSchema = useFormSchema();

  const hideModal = useCallback(() => {
    dispatch(editorActions.hideModal());
  }, [dispatch]);

  const initialFormState = useInitialFormState({ activeElement, activeRecipe });
  const { createRecipeFromElement, createRecipeFromRecipe } = useSaveCallbacks({
    activeElement,
  });

  const onSubmit: OnSubmit<ModMetadataFormState> = async (values, helpers) => {
    try {
      // `activeRecipe` must come first. It's possible that both activeElement and activeRecipe are set because
      // activeRecipe will be the recipe of the active element if in a "Save as New" workflow for an existing recipe
      if (activeRecipe) {
        await createRecipeFromRecipe(activeRecipe, values);
      } else if (activeElement) {
        await createRecipeFromElement(activeElement, values);
      } else {
        // Should not happen in practice
        // noinspection ExceptionCaughtLocallyJS
        throw new Error("Expected either active element or mod");
      }

      hideModal();
    } catch (error) {
      if (isSingleObjectBadRequestError(error) && error.response.data.config) {
        helpers.setStatus(error.response.data.config);
        return;
      }

      notify.error({
        message: "Error creating mod",
        error,
      });
    } finally {
      helpers.setSubmitting(false);
    }
  };

  const renderBody: RenderBody = () => (
    <Modal.Body>
      <ConnectedFieldTemplate
        name="id"
        label="Mod ID"
        description={FieldDescriptions.MOD_ID}
        widerLabel
        as={RegistryIdWidget}
      />
      <ConnectedFieldTemplate
        name="name"
        label="Name"
        widerLabel
        description={FieldDescriptions.MOD_NAME}
      />
      <ConnectedFieldTemplate
        name="version"
        label="Version"
        widerLabel
        description={FieldDescriptions.MOD_VERSION}
      />
      <ConnectedFieldTemplate
        name="description"
        label="Description"
        widerLabel
        description={FieldDescriptions.MOD_DESCRIPTION}
      />
    </Modal.Body>
  );

  const renderSubmit: RenderSubmit = ({ isSubmitting, isValid }) => (
    <Modal.Footer>
      <Button variant="info" onClick={hideModal}>
        Cancel
      </Button>
      <Button
        variant="primary"
        type="submit"
        disabled={!isValid || isSubmitting}
      >
        Create
      </Button>
    </Modal.Footer>
  );

  return (
    <RequireScope scopeSettingsDescription="To create a mod, you must first set an account alias for your PixieBrix account">
      {isRecipeFetching ? (
        <Loader />
      ) : (
        <Form
          validationSchema={formSchema}
          showUntouchedErrors
          validateOnMount
          initialValues={initialFormState}
          onSubmit={onSubmit}
          renderBody={renderBody}
          renderSubmit={renderSubmit}
        />
      )}
    </RequireScope>
  );
};

const CreateRecipeModal: React.FunctionComponent = () => {
  const { isCreateRecipeModalVisible: show } = useSelector(
    selectEditorModalVisibilities
  );

  const dispatch = useDispatch();
  const hideModal = useCallback(() => {
    dispatch(editorActions.hideModal());
  }, [dispatch]);

  return (
    <ModalLayout title="Create new mod" show={show} onHide={hideModal}>
      <CreateRecipeModalBody />
    </ModalLayout>
  );
};

export default CreateRecipeModal;
