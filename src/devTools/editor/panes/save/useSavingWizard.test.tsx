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

import { optionsSlice } from "@/options/slices";
import {
  AnyAction,
  configureStore,
  EnhancedStore,
  Store,
} from "@reduxjs/toolkit";
import { renderHook, act } from "@testing-library/react-hooks";
import React from "react";
import { Provider } from "react-redux";
import { editorSlice } from "@/devTools/editor/slices/editorSlice";
import { savingExtensionSlice } from "./savingExtensionSlice";
import useSavingWizard from "./useSavingWizard";
import {
  formStateFactory,
  menuItemFormStateFactory,
  metadataFactory,
  recipeFactory,
} from "@/tests/factories";
import useCreateMock from "@/devTools/editor/hooks/useCreate";
import useResetMock from "@/devTools/editor/hooks/useReset";
import {
  useCreateRecipeMutation as useCreateRecipeMutationMock,
  useGetRecipesQuery as useGetRecipesQueryMock,
  useGetEditablePackagesQuery as useGetEditablePackagesQueryMock,
} from "@/services/api";
import { selectElements } from "@/devTools/editor/slices/editorSelectors";
import { uuidv4 } from "@/types/helpers";
import menuItem from "@/devTools/editor/extensionPoints/menuItem";

jest.unmock("react-redux");

jest.mock("@/devTools/editor/hooks/useCreate");
jest.mock("@/devTools/editor/hooks/useReset");

jest.mock("@/services/api", () => ({
  useCreateRecipeMutation: jest.fn().mockReturnValue([]),
  useUpdateRecipeMutation: jest.fn().mockReturnValue([]),
  useGetRecipesQuery: jest.fn().mockReturnValue({
    data: [],
    isLoading: false,
  }),
  useGetEditablePackagesQuery: jest.fn().mockReturnValue({
    data: [],
    isLoading: false,
  }),
}));

const createStore = (initialState?: any) =>
  configureStore({
    reducer: {
      options: optionsSlice.reducer,
      editor: editorSlice.reducer,
      savingExtension: savingExtensionSlice.reducer,
    },
    preloadedState: initialState,
  });

afterEach(() => {
  jest.clearAllMocks();
});

const renderUseSavingWizard = (store: Store) =>
  renderHook(() => useSavingWizard(), {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  });

test("maintains wizard open state", () => {
  const metadata = metadataFactory();
  const element = formStateFactory({
    recipe: metadata,
  });
  const store = createStore();
  store.dispatch(editorSlice.actions.addElement(element));

  const { result } = renderUseSavingWizard(store);
  // Modal is closed.
  expect(result.current.isWizardOpen).toBe(false);

  // Save will open the modal window.
  // Should not await for the promise to resolve to check that window is open.
  act(() => {
    void result.current.save().catch((error: unknown) => {
      // Got an error, failing the test
      console.error(error);
      expect(error).toBeUndefined();
    });
  });

  // Modal is open/
  expect(result.current.isWizardOpen).toBe(true);

  const { result: anotherResult } = renderUseSavingWizard(store);
  // Using hook in another component still report open Modal
  expect(anotherResult.current.isWizardOpen).toBe(true);

  act(() => {
    result.current.closeWizard();
  });

  // Closing Modal in one of the components triggers state update in all components
  expect(result.current.isWizardOpen).toBe(false);
  expect(anotherResult.current.isWizardOpen).toBe(false);
});

test("saves non recipe element", async () => {
  const element = formStateFactory();
  const store = createStore();
  store.dispatch(editorSlice.actions.addElement(element));

  const createMock = jest.fn();
  (useCreateMock as jest.Mock).mockReturnValueOnce(createMock);

  const { result } = renderUseSavingWizard(store);

  act(() => {
    result.current.save().catch((error: unknown) => {
      // Got an error, failing the test
      console.error(error);
      expect(error).toBeUndefined();
    });
  });

  expect(result.current.savingExtensionId).toBe(element.uuid);
  expect(createMock).toHaveBeenCalledTimes(1);
  expect(createMock).toHaveBeenCalledWith(element, expect.any(Function));
});

test("saves as personal extension", async () => {
  // Set up environment
  const recipe = recipeFactory();
  (useGetRecipesQueryMock as jest.Mock).mockReturnValue({
    data: [recipe],
    isLoading: false,
  });

  const element = formStateFactory({
    recipe: recipe.metadata,
  });
  const store = createStore();
  store.dispatch(editorSlice.actions.addElement(element));

  const createMock = jest.fn();
  (useCreateMock as jest.Mock).mockReturnValue(createMock);

  const resetMock = jest.fn();
  (useResetMock as jest.Mock).mockReturnValue(resetMock);

  // Render hook
  const { result } = renderUseSavingWizard(store);

  // Get into the saving process
  act(() => {
    void result.current.save().catch((error: unknown) => {
      // Got an error, failing the test
      console.error(error);
      expect(error).toBeUndefined();
    });
  });

  expect(result.current.isWizardOpen).toBe(true);
  expect(result.current.savingExtensionId).toBeNull();

  // Saving as personal extension
  await act(async () => result.current.saveElementAsPersonalExtension());

  // Check wizard state
  expect(result.current.isWizardOpen).toBe(true);
  expect(result.current.savingExtensionId).not.toBeNull();
  expect(result.current.savingExtensionId).not.toBe(element.uuid);

  // Check new element added
  const elements = selectElements(store.getState());
  expect(elements).toHaveLength(2);
  expect(elements[0].recipe).toBe(recipe.metadata);
  expect(elements[1].recipe).toBeUndefined();

  // Check the source element is reset
  expect(resetMock).toHaveBeenCalledTimes(1);
  expect(resetMock).toHaveBeenCalledWith({
    element: elements[0],
    shouldShowConfirmation: false,
  });

  // Check new element is saved
  expect(createMock).toHaveBeenCalledTimes(1);
  expect(createMock).toHaveBeenCalledWith(elements[1], expect.any(Function));
});

test("saves as new recipe", async () => {
  // Set up environment
  const recipe = recipeFactory();
  (useGetRecipesQueryMock as jest.Mock).mockReturnValue({
    data: [recipe],
    isLoading: false,
  });

  (useGetEditablePackagesQueryMock as jest.Mock).mockReturnValue({
    data: [{ name: recipe.metadata.id, id: uuidv4() }],
    isLoading: false,
  });

  const extensionLabel = recipe.extensionPoints[0].label;
  const element = menuItemFormStateFactory({
    label: extensionLabel,
    recipe: recipe.metadata,
  });
  const extension = menuItem.selectExtension(element);
  const store = createStore({
    options: {
      extensions: [extension],
    },
  });
  store.dispatch(editorSlice.actions.addElement(element));

  const createMock = jest.fn();
  (useCreateMock as jest.Mock).mockReturnValue(createMock);

  const resetMock = jest.fn();
  (useResetMock as jest.Mock).mockReturnValue(resetMock);

  (useCreateRecipeMutationMock as jest.Mock).mockReturnValue([
    jest.fn().mockReturnValue({}),
  ]);

  // Render hook
  const { result } = renderUseSavingWizard(store);

  // Get into the saving process
  act(() => {
    void result.current.save();
  });

  expect(result.current.isWizardOpen).toBe(true);
  expect(result.current.savingExtensionId).toBeNull();

  // Saving with a new Recipe
  const newRecipeMeta = metadataFactory();
  await act(async () =>
    result.current.saveElementAndCreateNewRecipe(newRecipeMeta)
  );

  // Check wizard state
  expect(result.current.isWizardOpen).toBe(true);
  expect(result.current.savingExtensionId).toBe(element.uuid);

  // Check the element is saved
  const elements = selectElements(store.getState());
  expect(elements).toHaveLength(1);
  expect(createMock).toHaveBeenCalledTimes(1);

  const expectedUpdatedElement = {
    ...element,
    recipe: newRecipeMeta,
  };
  expect(createMock).toHaveBeenCalledWith(
    expectedUpdatedElement,
    expect.any(Function)
  );
});
