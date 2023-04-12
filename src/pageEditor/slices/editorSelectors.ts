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

import { createSelector } from "reselect";
import {
  type EditorRootState,
  ModalKey,
  type RootState,
} from "@/pageEditor/pageEditorTypes";
import { selectExtensions } from "@/store/extensionsSelectors";
import { flatMap, isEmpty, sortBy, uniqBy } from "lodash";
import { DataPanelTabKey } from "@/pageEditor/tabs/editTab/dataPanel/dataPanelTypes";
import {
  type ElementUIState,
  type TabUIState,
} from "@/pageEditor/uiState/uiStateTypes";
import { type ExtensionsRootState } from "@/store/extensionsTypes";
import { type FormState } from "@/pageEditor/extensionPoints/formStateTypes";
import { deserializeError } from "serialize-error";
import { type IExtension } from "@/types/extensionTypes";
import { type RegistryId } from "@/types/registryTypes";
import { type UUID } from "@/types/stringTypes";
import { AnnotationType } from "@/types/annotationTypes";

export const selectActiveElementId = ({ editor }: EditorRootState) => {
  if (editor == null) {
    console.warn("selectActiveElementId called without editor redux slice");
    return null;
  }

  return editor.activeElementId;
};

export const selectElements = ({ editor }: EditorRootState) => editor.elements;

export const selectActiveElement = createSelector(
  selectActiveElementId,
  selectElements,
  (activeElementId, elements) =>
    elements.find((x) => x.uuid === activeElementId)
);

export const selectActiveRecipeId = ({ editor }: EditorRootState) =>
  editor.activeRecipeId;

export const selectShowV3UpgradeMessageForActiveElement = createSelector(
  selectActiveElementId,
  ({ editor }: EditorRootState) => editor.showV3UpgradeMessageByElement,
  (activeElementId, showV3UpgradeMessageByElement) =>
    // eslint-disable-next-line security/detect-object-injection -- using an internally-looked-up uuid
    showV3UpgradeMessageByElement[activeElementId] ?? false
);

export const selectInserting = ({ editor }: EditorRootState) =>
  editor.inserting;

export const selectErrorState = ({ editor }: EditorRootState) => ({
  isBetaError: editor.error && editor.beta,
  editorError: editor.error ? deserializeError(editor.error) : null,
});

export const selectDirty = ({ editor }: EditorRootState) => editor.dirty;

export const selectDeletedElements = ({ editor }: EditorRootState) =>
  editor.deletedElementsByRecipeId;

const selectAllDeletedElementIds = ({ editor }: EditorRootState) =>
  new Set(
    flatMap(editor.deletedElementsByRecipeId).map((formState) => formState.uuid)
  );

export const selectNotDeletedElements: ({
  editor,
}: EditorRootState) => FormState[] = createSelector(
  selectElements,
  selectAllDeletedElementIds,
  (elements, deletedElementIds) =>
    elements.filter(({ uuid }) => !deletedElementIds.has(uuid))
);

export const selectNotDeletedExtensions: ({
  options,
}: ExtensionsRootState) => IExtension[] = createSelector(
  selectExtensions,
  selectAllDeletedElementIds,
  (extensions, deletedElementIds) =>
    extensions.filter(({ id }) => !deletedElementIds.has(id))
);

export const selectDirtyRecipeOptionDefinitions = ({
  editor,
}: EditorRootState) => editor.dirtyRecipeOptionsById;

const dirtyOptionDefinitionsForRecipeIdSelector = createSelector(
  selectDirtyRecipeOptionDefinitions,
  (state: EditorRootState, recipeId: RegistryId) => recipeId,
  (dirtyRecipeOptionDefinitionsById, recipeId) =>
    // eslint-disable-next-line security/detect-object-injection -- RegistryId for recipe
    dirtyRecipeOptionDefinitionsById[recipeId]
);

export const selectDirtyOptionDefinitionsForRecipeId =
  (recipeId: RegistryId) => (state: EditorRootState) =>
    dirtyOptionDefinitionsForRecipeIdSelector(state, recipeId);

const dirtyOptionValuesForRecipeIdSelector = createSelector(
  selectNotDeletedElements,
  (state: EditorRootState, recipeId: RegistryId) => recipeId,
  (elements, recipeId) =>
    elements.find((element) => element.recipe?.id === recipeId)?.optionsArgs
);

export const selectDirtyOptionValuesForRecipeId =
  (recipeId: RegistryId) => (state: EditorRootState) =>
    dirtyOptionValuesForRecipeIdSelector(state, recipeId);

export const selectDirtyRecipeMetadata = ({ editor }: EditorRootState) =>
  editor.dirtyRecipeMetadataById;

const dirtyMetadataForRecipeIdSelector = createSelector(
  selectDirtyRecipeMetadata,
  (state: EditorRootState, recipeId: RegistryId) => recipeId,
  (dirtyRecipeMetadataById, recipeId) =>
    // eslint-disable-next-line security/detect-object-injection
    dirtyRecipeMetadataById[recipeId]
);

export const selectDirtyMetadataForRecipeId =
  (recipeId: RegistryId) => (state: EditorRootState) =>
    dirtyMetadataForRecipeIdSelector(state, recipeId);

const elementIsDirtySelector = createSelector(
  selectDirty,
  (state: RootState, elementId: UUID) => elementId,
  // eslint-disable-next-line security/detect-object-injection
  (dirty, elementId) => dirty[elementId] ?? false
);

export const selectElementIsDirty = (elementId: UUID) => (state: RootState) =>
  elementIsDirtySelector(state, elementId);

const recipeIsDirtySelector = createSelector(
  selectDirty,
  dirtyOptionDefinitionsForRecipeIdSelector,
  dirtyMetadataForRecipeIdSelector,
  (state: EditorRootState, recipeId: RegistryId) =>
    // eslint-disable-next-line security/detect-object-injection
    selectDeletedElements(state)[recipeId],
  ({ editor }: EditorRootState, recipeId: RegistryId) =>
    editor.elements
      .filter((element) => element.recipe?.id === recipeId)
      .map((element) => element.uuid),
  (
    dirtyElements,
    dirtyRecipeOptions,
    dirtyRecipeMetadata,
    deletedElements,
    elementIds
    // eslint-disable-next-line max-params
  ) => {
    const hasDirtyElements = elementIds.some(
      // eslint-disable-next-line security/detect-object-injection -- id extracted from element
      (elementId) => dirtyElements[elementId]
    );
    return (
      hasDirtyElements ||
      Boolean(dirtyRecipeOptions) ||
      Boolean(dirtyRecipeMetadata) ||
      !isEmpty(deletedElements)
    );
  }
);

export const selectRecipeIsDirty =
  (recipeId?: RegistryId) => (state: EditorRootState) =>
    Boolean(recipeId) && recipeIsDirtySelector(state, recipeId);

export const selectEditorModalVisibilities = ({ editor }: EditorRootState) => ({
  isAddToRecipeModalVisible: editor.visibleModalKey === ModalKey.ADD_TO_RECIPE,
  isRemoveFromRecipeModalVisible:
    editor.visibleModalKey === ModalKey.REMOVE_FROM_RECIPE,
  isSaveAsNewRecipeModalVisible:
    editor.visibleModalKey === ModalKey.SAVE_AS_NEW_RECIPE,
  isCreateRecipeModalVisible: editor.visibleModalKey === ModalKey.CREATE_RECIPE,
  isAddBlockModalVisible: editor.visibleModalKey === ModalKey.ADD_BLOCK,
});

export const selectInstalledRecipeMetadatas = createSelector(
  selectElements,
  selectExtensions,
  (elements, extensions) => {
    const elementRecipes: Array<IExtension["_recipe"]> = elements
      .filter((element) => Boolean(element.recipe))
      .map((element) => element.recipe);
    const extensionRecipes: Array<IExtension["_recipe"]> = extensions
      .filter((extension) => Boolean(extension._recipe))
      .map((extension) => extension._recipe);

    return uniqBy(
      [...elementRecipes, ...extensionRecipes],
      (recipe) => recipe.id
    );
  }
);

export const selectSelectionSeq = ({ editor }: EditorRootState) =>
  editor.selectionSeq;

export const selectNewRecipeIds = ({ editor }: EditorRootState) =>
  editor.newRecipeIds;

export const selectKeepLocalCopyOnCreateRecipe = ({
  editor,
}: EditorRootState) => editor.keepLocalCopyOnCreateRecipe;

export const selectExpandedRecipeId = ({ editor }: EditorRootState) =>
  editor.expandedRecipeId;

// UI state
export function selectActiveElementUIState({
  editor,
}: EditorRootState): ElementUIState {
  return editor.elementUIStates[editor.activeElementId];
}

const selectActiveNodeUIState = createSelector(
  selectActiveElementUIState,
  (elementUIState) => elementUIState.nodeUIStates[elementUIState.activeNodeId]
);

export const selectActiveNodeId = createSelector(
  selectActiveElementUIState,
  (elementUIState) => elementUIState?.activeNodeId
);

export const selectPipelineMap = createSelector(
  selectActiveElementUIState,
  (uiState: ElementUIState) => uiState?.pipelineMap
);

export const selectActiveNodeInfo = createSelector(
  selectActiveElementUIState,
  selectActiveNodeId,
  (uiState: ElementUIState, activeNodeId: UUID) =>
    // eslint-disable-next-line security/detect-object-injection -- UUID
    uiState.pipelineMap[activeNodeId]
);

const activeElementNodeInfoSelector = createSelector(
  selectActiveElementUIState,
  (state: EditorRootState, instanceId: UUID) => instanceId,
  // eslint-disable-next-line security/detect-object-injection -- using a node uuid
  (uiState: ElementUIState, instanceId: UUID) => uiState.pipelineMap[instanceId]
);

export const selectActiveElementNodeInfo =
  (instanceId: UUID) => (state: EditorRootState) =>
    activeElementNodeInfoSelector(state, instanceId);

const parentBlockInfoSelector = createSelector(
  selectActiveElementUIState,
  (state: EditorRootState, instanceId: UUID) => instanceId,
  (uiState: ElementUIState, instanceId: UUID) => {
    if (uiState == null) {
      return null;
    }

    // eslint-disable-next-line security/detect-object-injection -- UUID
    const { parentNodeId } = uiState.pipelineMap[instanceId];
    if (!parentNodeId) {
      return null;
    }

    // eslint-disable-next-line security/detect-object-injection -- UUID
    return uiState.pipelineMap[parentNodeId];
  }
);

/**
 * Return the block with the pipeline that contains the given node.
 * @param instanceId the block instanceId
 */
export const selectParentBlockInfo =
  (instanceId: UUID) => (state: EditorRootState) =>
    parentBlockInfoSelector(state, instanceId);

export const selectNodeDataPanelTabSelected: (
  rootState: EditorRootState
) => DataPanelTabKey = createSelector(
  selectActiveNodeUIState,
  (nodeUIState) => nodeUIState.dataPanel.activeTabKey
);

export function selectNodeDataPanelTabState(
  rootState: EditorRootState,
  tabKey: DataPanelTabKey
): TabUIState {
  const nodeUIState = selectActiveNodeUIState(rootState);
  // eslint-disable-next-line security/detect-object-injection -- tabKeys will be hard-coded strings
  return nodeUIState.dataPanel[tabKey];
}

/**
 * Selects the activeElement of the Document or Form builder on the Preview tab
 */
export function selectNodePreviewActiveElement(state: EditorRootState): string {
  return selectNodeDataPanelTabState(state, DataPanelTabKey.Preview)
    .activeElement;
}

export const selectAddBlockLocation = ({ editor }: EditorRootState) =>
  editor.addBlockLocation;

const annotationsForPathSelector = createSelector(
  selectActiveElementId,
  // Null-safe access here so this doesn't break with the options redux store
  (state: RootState) => state.analysis?.extensionAnnotations,
  (state: RootState, path: string) => path,
  (activeElementId, annotations, path) => {
    // eslint-disable-next-line security/detect-object-injection -- UUID
    const elementAnnotations = annotations?.[activeElementId] ?? [];
    const pathAnnotations = elementAnnotations.filter(
      (x) => x.position.path === path
    );
    return sortBy(pathAnnotations, (annotation) => {
      switch (annotation.type) {
        case AnnotationType.Error: {
          return 2;
        }

        case AnnotationType.Warning: {
          return 1;
        }

        default: {
          return 0;
        }
      }
    });
  }
);

/**
 * Selects the annotations for the given path
 * @param path A path relative to the root of the extension or root pipeline
 */
export const selectAnnotationsForPath = (path: string) => (state: RootState) =>
  annotationsForPathSelector(state, path);

export const selectCopiedBlock = ({ editor }: EditorRootState) =>
  editor.copiedBlock;

export const selectExtensionAvailability = ({
  editor: {
    availableInstalledIds,
    unavailableInstalledCount,
    isPendingInstalledExtensions,
    availableDynamicIds,
    unavailableDynamicCount,
    isPendingDynamicExtensions,
  },
}: EditorRootState) => ({
  availableInstalledIds,
  unavailableInstalledCount,
  isPendingInstalledExtensions,
  availableDynamicIds,
  unavailableDynamicCount,
  isPendingDynamicExtensions,
});
