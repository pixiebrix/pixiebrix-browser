/* eslint-disable security/detect-object-injection -- lots of deleting by UUID */
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

import {
  readReduxStorage,
  type ReduxStorageKey,
  setReduxStorage,
} from "@/chrome";
import { type RegistryId, type UUID } from "@/core";
import { type EditorState } from "@/pageEditor/pageEditorTypes";
import { produce } from "immer";
import { mapValues } from "lodash";

const STORAGE_KEY = "persist:editor" as ReduxStorageKey;

/**
 * Read dynamic elements from local storage (without going through redux-persist)
 */
async function getEditorState(): Promise<EditorState> {
  const storage: Record<string, string> = await readReduxStorage(STORAGE_KEY);
  // Redux-persist stores the values of each top-level property in the state object as a JSON string
  return mapValues(storage, (value) => JSON.parse(value)) as EditorState;
}

async function saveEditorState(state: EditorState): Promise<void> {
  await setReduxStorage(
    STORAGE_KEY,
    // Redux-persist stores the values of each top-level property in the state object as a JSON string
    mapValues(state, (value) => JSON.stringify(value))
  );
}

async function removeElements(
  state: EditorState,
  elementIds: UUID[]
): Promise<EditorState> {
  return produce(state, (draft) => {
    for (const elementId of elementIds) {
      if (state.activeElementId === elementId) {
        draft.activeElementId = null;
      }

      delete draft.dirty[elementId];
      delete draft.elementUIStates[elementId];
      delete draft.showV3UpgradeMessageByElement[elementId];
      draft.availableDynamicIds = draft.availableDynamicIds.filter(
        (id) => id !== elementId
      );
      draft.elements = draft.elements.filter(
        (element) => element.uuid !== elementId
      );
    }
  });
}

/**
 * Remove a list of elements by id from persisted redux storage.
 *
 * Note: this does not trigger a change even in any current redux instances
 * @param elementIds the elements to remove from persisted redux storage
 *
 * The logic here needs to be roughly kept in sync with removeElement in the redux helpers
 * @see removeElement
 */
export async function removeDynamicElements(elementIds: UUID[]): Promise<void> {
  const state = await getEditorState();
  const newState = await removeElements(state, elementIds);
  await saveEditorState(newState);
}

/**
 * Remove all elements for a given recipe from persisted redux storage.
 *
 * Note: this does not trigger a change even in any current redux instances
 * @param recipeId The recipe to remove
 *
 * The logic here needs to be roughly kept in sync with the useRemoveRecipe hook
 * @see useRemoveRecipe.ts
 */
export async function removeDynamicElementsForRecipe(
  recipeId: RegistryId
): Promise<void> {
  const state = await getEditorState();
  const nextState = produce(state, (draft) => {
    if (state.activeRecipeId === recipeId) {
      draft.activeRecipeId = null;
    }

    if (state.expandedRecipeId === recipeId) {
      draft.expandedRecipeId = null;
    }

    delete draft.dirtyRecipeOptionsById[recipeId];
    delete draft.dirtyRecipeMetadataById[recipeId];
    delete draft.deletedElementsByRecipeId[recipeId];
  });
  const elementIds = state.elements
    .filter((element) => element.recipe?.id === recipeId)
    .map((element) => element.uuid);
  const newState = await removeElements(nextState, elementIds);
  await saveEditorState(newState);
}
