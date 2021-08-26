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

import {
  migrateExtensionsShape,
  migrateActiveExtensions,
  ExtensionOptionsState,
} from "@/store/extensions";
import { readStorageWithMigration, setStorage } from "@/chrome";

const STORAGE_KEY = "persist:extensionOptions";
const INITIAL_STATE = {};

type JSONString = string;

type RawOptionsState = Record<string, JSONString>;

async function getOptionsState(): Promise<RawOptionsState> {
  return readStorageWithMigration(STORAGE_KEY, INITIAL_STATE);
}

/**
 * Read extension options from local storage (without going through redux-persistor).
 */
export async function loadOptions(): Promise<ExtensionOptionsState> {
  console.debug("Loading raw options from storage");

  const base = await getOptionsState();
  // The redux persist layer persists the extensions value as as JSON-string.
  // Also apply the upgradeExtensionsState migration here because the migration in store might not have run yet.
  return migrateActiveExtensions(
    migrateExtensionsShape({ extensions: JSON.parse(base.extensions) })
  );
}

/**
 * Save extension options to local storage (without going through redux-persistor).
 */
export async function saveOptions(state: ExtensionOptionsState): Promise<void> {
  const base = await getOptionsState();
  await setStorage(STORAGE_KEY, {
    ...base,
    // The redux persist layer persists the extensions value as as JSON-string
    extensions: JSON.stringify(state.extensions),
  });
}
