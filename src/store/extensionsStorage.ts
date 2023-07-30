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

import { localStorage } from "redux-persist-webextension-storage";
import { createMigrate } from "redux-persist";
import {
  migrateActiveExtensions,
  migrateExtensionsShape,
  migrations,
} from "@/store/extensionsMigrations";
import { type ModComponentOptionsState } from "./extensionsTypes";
import { type StorageInterface } from "@/store/StorageInterface";
import { type RegistryId } from "@/types/registryTypes";
import { compact } from "lodash";
import { boolean } from "@/utils/typeUtils";
import {
  readReduxStorage,
  ReduxStorageKey,
  setReduxStorage,
} from "@/utils/storageUtils";

const STORAGE_KEY = "persist:extensionOptions" as ReduxStorageKey;

type JSONString = string;

type PersistedOptionsState = Record<string, JSONString>;

async function getOptionsState(): Promise<PersistedOptionsState> {
  return readReduxStorage(STORAGE_KEY, {});
}

/**
 * Read extension options from local storage (without going through redux-persistor).
 */
export async function loadOptions(): Promise<ModComponentOptionsState> {
  const base = await getOptionsState();
  // The redux persist layer persists the extensions value as JSON-string.
  // Also apply the upgradeExtensionsState migration here because the migration in store might not have run yet.
  return migrateActiveExtensions(
    migrateExtensionsShape({
      extensions: JSON.parse(base.extensions ?? "[]"),
    })
  );
}

/**
 * Returns the set of currently activated mod ids. Reads current activated mods from storage.
 */
export async function getActivatedModIds(): Promise<Set<RegistryId>> {
  const options = await loadOptions();

  if (!options) {
    return new Set();
  }

  return new Set(
    compact(options.extensions.map((extension) => extension._recipe?.id))
  );
}

/**
 * Save extension options to local storage (without going through redux-persistor).
 */
export async function saveOptions(
  state: ModComponentOptionsState
): Promise<void> {
  const base = await getOptionsState();
  await setReduxStorage(STORAGE_KEY, {
    ...base,
    // The redux persist layer persists the extensions value as a JSON-string
    extensions: JSON.stringify(state.extensions),
  });
}

export const persistExtensionOptionsConfig = {
  key: "extensionOptions",
  // Change the type of localStorage to our overridden version so that it can be exported
  // See: @/store/StorageInterface.ts
  storage: localStorage as StorageInterface,
  version: 2,
  // https://github.com/rt2zz/redux-persist#migrations
  migrate: createMigrate(migrations, { debug: boolean(process.env.DEBUG) }),
};
