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

import { type MigrationManifest, type PersistedState } from "redux-persist";
import {
  type SettingsStateV1,
  type SettingsStateV2,
  type SettingsStateV3,
} from "@/store/settings/settingsTypes";

export const migrations: MigrationManifest = {
  // Redux-persist defaults to version: -1; Initialize to positive-1-indexed
  // state version to match state type names
  0: (state) => state,
  1: (state) => state,
  2: (state: SettingsStateV1 & PersistedState) => migrateSettingsStateV1(state),
  3: (state: SettingsStateV2 & PersistedState) => migrateSettingsStateV2(state),
};

function migrateSettingsStateV1({
  authServiceId,
  ...state
}: SettingsStateV1 & PersistedState): SettingsStateV2 & PersistedState {
  return {
    ...state,
    authIntegrationId: authServiceId,
  };
}

function migrateSettingsStateV2({
  varAutosuggest,
  ...state
}: SettingsStateV2 & PersistedState): SettingsStateV3 & PersistedState {
  return {
    ...state,
    varAutosuggest: varAutosuggest == null ? true : varAutosuggest,
  };
}
