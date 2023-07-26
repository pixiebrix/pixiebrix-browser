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

import { serializeError } from "serialize-error";
import {
  initialState,
  modDefinitionsActions,
  modDefinitionsSlice,
} from "./modDefinitionsSlice";
import { type ModDefinitionsRootState } from "./modDefinitionsTypes";
import recipesRegistry from "./registry";
import { syncRemotePackages } from "@/baseRegistry";
import { recipeFactory } from "@/testUtils/factories/modDefinitionFactories";

jest.mock("./registry", () => ({
  __esModule: true,
  default: {
    all: jest.fn(),
  },
}));

jest.mock("@/baseRegistry", () => ({
  __esModule: true,
  ...jest.requireActual("@/baseRegistry"),
  syncRemotePackages: jest.fn(),
}));

afterEach(() => {
  jest.resetAllMocks();
});

const syncRemotePackagesMock = syncRemotePackages as jest.MockedFn<
  typeof syncRemotePackages
>;

describe("loadModDefinitionsFromCache", () => {
  test("calls registry and dispatches setModDefinitionsFromCache action", async () => {
    const dispatch = jest.fn();
    const cachedRecipes = [recipeFactory()];
    (recipesRegistry.all as jest.Mock).mockResolvedValueOnce(cachedRecipes);

    const thunkFunction = modDefinitionsActions.loadModDefinitionsFromCache();
    await thunkFunction(
      dispatch,
      () => ({ modDefinitions: initialState }),
      undefined
    );
    expect(recipesRegistry.all).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      modDefinitionsActions.setModDefinitionsFromCache(cachedRecipes)
    );
  });
});

describe("refreshRecipes", () => {
  test("doesn't refresh if already loading", async () => {
    const dispatch = jest.fn();

    const thunkFunction = modDefinitionsActions.syncRemoteModDefinitions();
    await thunkFunction(
      dispatch,
      () => ({
        modDefinitions: {
          ...initialState,
          isFetchingFromRemote: true,
          isRemoteUninitialized: false,
        },
      }),
      undefined
    );

    expect(syncRemotePackagesMock).not.toHaveBeenCalled();
  });

  test("fetches recipes and updates the state", async () => {
    const dispatch = jest.fn();

    const cachedRecipes = [recipeFactory()];
    (recipesRegistry.all as jest.Mock).mockResolvedValueOnce(cachedRecipes);

    const thunkFunction = modDefinitionsActions.syncRemoteModDefinitions();
    await thunkFunction(
      dispatch,
      () => ({ modDefinitions: {} } as ModDefinitionsRootState),
      undefined
    );

    expect(dispatch).toHaveBeenCalledWith(
      modDefinitionsActions.startFetchingFromRemote()
    );
    expect(syncRemotePackagesMock).toHaveBeenCalledTimes(1);
    expect(recipesRegistry.all).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      modDefinitionsActions.setModDefinitions(cachedRecipes)
    );
  });

  test("sets error state", async () => {
    const dispatch = jest.fn();

    const error = new Error("test");
    syncRemotePackagesMock.mockRejectedValueOnce(error);

    const thunkFunction = modDefinitionsActions.syncRemoteModDefinitions();
    await thunkFunction(
      dispatch,
      () => ({ modDefinitions: {} } as ModDefinitionsRootState),
      undefined
    );

    const serializedError = serializeError(error, { useToJSON: false });
    expect(dispatch).toHaveBeenCalledWith(
      modDefinitionsActions.setError(serializedError)
    );
  });
});

describe("reducers", () => {
  test("startFetchingFromRemote does not set isLoading", () => {
    const state = { ...initialState };
    const nextState = modDefinitionsSlice.reducer(
      state,
      modDefinitionsActions.startFetchingFromRemote()
    );
    expect(nextState.isFetching).toBeTrue();
    expect(nextState.isLoading).toBeFalse();
  });

  test("sets recipes", () => {
    const recipes = [recipeFactory()];
    const state = {
      ...initialState,
      isFetching: true,
      isLoading: true,
      isError: true,
      isSuccess: false,
      isCacheUninitialized: false,
      isRemoteUninitialized: false,
      error: new Error("test"),
    };
    const nextState = modDefinitionsSlice.reducer(
      state,
      modDefinitionsActions.setModDefinitions(recipes)
    );

    expect(nextState).toEqual({
      data: recipes,
      currentData: recipes,
      isFetching: false,
      isLoading: false,
      isUninitialized: false,
      isError: false,
      isSuccess: true,
      error: undefined,
      // Cache-specific aysnc state
      isLoadingFromCache: false,
      isFetchingFromRemote: false,
      isLoadingFromRemote: false,
      isCacheUninitialized: false,
      isRemoteUninitialized: false,
    });
  });
});
