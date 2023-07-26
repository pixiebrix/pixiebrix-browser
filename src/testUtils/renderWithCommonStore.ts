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

import { configureStore } from "@reduxjs/toolkit";
import { persistReducer } from "redux-persist";
import { authSlice, persistAuthConfig } from "@/auth/authSlice";
import { persistSettingsConfig } from "@/store/settingsStorage";
import settingsSlice from "@/store/settingsSlice";
import { appApi } from "@/services/api";
import { modDefinitionsMiddleware } from "@/modDefinitions/modDefinitionsListenerMiddleware";
import {
  createRenderHookWithWrappers,
  createRenderWithWrappers,
} from "@/testUtils/testHelpers";
import servicesSlice from "@/store/servicesSlice";

function configureCommonStoreForTests(initialState?: any) {
  return configureStore({
    reducer: {
      auth: persistReducer(persistAuthConfig, authSlice.reducer),
      settings: persistReducer(persistSettingsConfig, settingsSlice.reducer),
      services: servicesSlice.reducer,
      [appApi.reducerPath]: appApi.reducer,
    },
    middleware(getDefaultMiddleware) {
      /* eslint-disable unicorn/prefer-spread -- It's not Array#concat, can't use spread */
      return getDefaultMiddleware()
        .concat(appApi.middleware)
        .concat(modDefinitionsMiddleware);
      /* eslint-enable unicorn/prefer-spread */
    },
    preloadedState: initialState,
  });
}

const renderWithWrappers = createRenderWithWrappers(
  configureCommonStoreForTests
);
const renderHookWithWrappers = createRenderHookWithWrappers(
  configureCommonStoreForTests
);

// eslint-disable-next-line import/export -- re-export RTL
export * from "@testing-library/react";
// eslint-disable-next-line import/export -- override render
export { renderWithWrappers as render };
export { renderHookWithWrappers as renderHook };
