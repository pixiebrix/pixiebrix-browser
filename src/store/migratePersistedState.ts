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
  type MigrationManifest,
  type PersistedState,
} from "redux-persist/es/types";
import { produce } from "immer";
import { type SetOptional } from "type-fest";
import { type UnknownObject } from "@/types/objectTypes";
import { isEmpty } from "lodash";

export function getMaxMigrationsVersion(migrations: MigrationManifest): number {
  if (isEmpty(migrations)) {
    return 0;
  }

  return Math.max(...Object.keys(migrations).map(Number));
}

/**
 * Use a given set of redux-persist migrations to migrate the given state to the latest version.
 *
 * @param state a persisted redux state slice that may or may not be out of date
 * @param migrations the redux-persist migrations for the given state slice
 * @param inferPersistedVersion if needed, a function to infer the persisted version
 *    from the given state shape (states/slices to which versioning was added after this
 *    migrations architecture was created, should not need to utilize this infer function)
 * @returns PersistedState the given state, if it is the latest version, otherwise an updated copy of the state
 */
// Optional persisted state for backwards compatibility
export default function migratePersistedState<MigratedState>(
  state: UnknownObject & SetOptional<PersistedState, "_persist">,
  migrations: MigrationManifest,
  inferPersistedVersion?: (state: UnknownObject) => number
): MigratedState {
  const maxVersion = getMaxMigrationsVersion(migrations);

  let storedState: PersistedState;

  if (state._persist) {
    storedState = {
      ...state,
      _persist: {
        version: state._persist.version,
        rehydrated: true, // We are re-hydrating manually
      },
    };
  } else {
    console.warn("Expected redux-persist state to have _persist property", {
      state,
    });
    storedState = {
      ...state,
      _persist: {
        // Do not use null-safe ?.() function call here, inferred version result could be 0 (falsy)
        version: inferPersistedVersion
          ? inferPersistedVersion(state)
          : maxVersion,
        rehydrated: true, // We are re-hydrating manually
      },
    };
  }

  while (storedState._persist.version < maxVersion) {
    const newVersion = storedState._persist.version + 1;
    // eslint-disable-next-line security/detect-object-injection -- number
    const migration = migrations[newVersion];

    if (migration == null) {
      throw new Error(
        `Redux persistence migration not found for version: ${storedState._persist.version}`
      );
    }

    if (typeof migration !== "function") {
      throw new TypeError(
        `Redux persistence migrations must be functions. For version: ${newVersion}, found: ${typeof migration}`
      );
    }

    storedState = {
      ...produce(storedState, migration),
      _persist: {
        version: newVersion,
        rehydrated: true,
      },
    };
  }

  return storedState as unknown as MigratedState;
}
