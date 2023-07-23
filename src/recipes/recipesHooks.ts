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

import { type ModDefinition } from "@/types/modDefinitionTypes";
import { useDispatch, useSelector } from "react-redux";
import { selectAllRecipes } from "@/recipes/recipesSelectors";
import { useCallback, useEffect } from "react";
import { recipesActions } from "./recipesSlice";
import { type RegistryId } from "@/types/registryTypes";
import {
  type AsyncState,
  type FetchableAsyncState,
  type UseCachedQueryResult,
} from "@/types/sliceTypes";
import useMemoCompare from "@/hooks/useMemoCompare";
import deepEquals from "fast-deep-equal";
import { loadingAsyncStateFactory } from "@/utils/asyncStateUtils";
import useMergeAsyncState from "@/hooks/useMergeAsyncState";

/**
 * Lookup a recipe from the registry by ID, or null if it doesn't exist.
 *
 * NOTE: uses useAllRecipes which first checks the local cache. So value may change from null to a recipe definition
 * after the remote fetch completes.
 *
 * If you want to return an error state if the recipe doesn't exist, use useRequiredRecipe instead.
 *
 * @param id the registry id of the recipe
 * @see useRequiredModDefinitions
 * @see useAllRecipes
 */
export function useOptionalRecipe(
  id: RegistryId
): FetchableAsyncState<ModDefinition | null> {
  const state = useAllRecipes();

  const findRecipe = useCallback(
    (recipes: ModDefinition[]) => recipes.find((x) => x.metadata.id === id),
    [id]
  );

  const recipeState = useMergeAsyncState(state, findRecipe);

  // Avoid reference change when useAllRecipes switches from cache to remote fetch
  const data = useMemoCompare(recipeState.data, deepEquals);
  const currentData = useMemoCompare(recipeState.data, deepEquals);

  return {
    ...recipeState,
    data,
    currentData,
  };
}

/**
 * Lookup mod definitions from the registry by ID, or return an error state if any don't exist.
 *
 * Only returns an error state if the remote fetch fails. If any mod is not found in the local cache, it will wait
 * until the remote fetch completes before returning an error state.
 *
 * @param ids the registry ids of the mod definitions
 * @see useOptionalRecipe
 * @see useAllRecipes
 */
export function useRequiredModDefinitions(
  ids: RegistryId[]
): AsyncState<ModDefinition[]> {
  const state = useAllRecipes();

  const recipeState = useMergeAsyncState(state, (mods: ModDefinition[]) => {
    const matches = mods.filter((x) => ids.includes(x.metadata.id));

    if (ids.length !== matches.length) {
      const missingIds = ids.filter(
        (x) => !matches.some((mod) => mod.metadata.id === x)
      );
      throw new Error(`Mod definition(s) not found: ${missingIds.join(", ")}`);
    }

    return matches;
  });

  // Avoid reference change when useAllRecipes switches from cache to remote fetch
  const data = useMemoCompare(recipeState.data, deepEquals);
  const currentData = useMemoCompare(recipeState.currentData, deepEquals);

  // Don't error until the lookup fails against the remote data
  if (
    recipeState.isError &&
    (state.isRemoteUninitialized || state.isLoadingFromRemote)
  ) {
    return loadingAsyncStateFactory();
  }

  return {
    ...recipeState,
    data,
    currentData,
  };
}

/**
 * Returns all recipes from the local registry, and triggers a remote refresh.
 *
 * Safe to include multiple times in the React tree, because it's connected to the Redux store.
 */
export function useAllRecipes(): UseCachedQueryResult<ModDefinition[]> {
  const dispatch = useDispatch();
  const refetch = useCallback(
    () => dispatch(recipesActions.syncRemoteRecipes()),
    [dispatch]
  );
  const state = useSelector(selectAllRecipes);

  // First load from local database
  useEffect(() => {
    if (state.isCacheUninitialized) {
      dispatch(recipesActions.loadRecipesFromCache());
    }
  }, [dispatch, state.isCacheUninitialized]);

  // Load from remote data source once the local data has been loaded
  useEffect(() => {
    if (
      state.isRemoteUninitialized &&
      !state.isLoadingFromCache &&
      !state.isCacheUninitialized
    ) {
      dispatch(recipesActions.syncRemoteRecipes());
    }
  }, [
    dispatch,
    state.isLoadingFromCache,
    state.isCacheUninitialized,
    state.isRemoteUninitialized,
  ]);

  return { ...state, refetch };
}
