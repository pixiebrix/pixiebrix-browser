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

import { configureStore, type Middleware } from "@reduxjs/toolkit";
import { persistReducer, persistStore } from "redux-persist";
import { createLogger } from "redux-logger";
import { boolean } from "@/utils";
import { setupListeners } from "@reduxjs/toolkit/dist/query/react";
import extensionsSlice from "@/store/extensionsSlice";
import { persistExtensionOptionsConfig } from "@/store/extensionsStorage";
import sidebarSlice from "@/sidebar/sidebarSlice";
import { persistSettingsConfig } from "@/store/settingsStorage";
import settingsSlice from "@/store/settingsSlice";
import { appApi } from "@/services/api";
import { authSlice, persistAuthConfig } from "@/auth/authSlice";
import servicesSlice, { persistServicesConfig } from "@/store/servicesSlice";
import { recipesSlice } from "@/recipes/recipesSlice";

const REDUX_DEV_TOOLS: boolean = boolean(process.env.REDUX_DEV_TOOLS);

const conditionalMiddleware: Middleware[] = [];
if (typeof createLogger === "function") {
  // Allow tree shaking of logger in production
  // https://github.com/LogRocket/redux-logger/issues/6
  conditionalMiddleware.push(createLogger());
}

const store = configureStore({
  reducer: {
    auth: persistReducer(persistAuthConfig, authSlice.reducer),
    options: persistReducer(
      persistExtensionOptionsConfig,
      extensionsSlice.reducer
    ),
    sidebar: sidebarSlice.reducer,
    settings: persistReducer(persistSettingsConfig, settingsSlice.reducer),
    // `services` slice is used to determine login state for partner installs
    services: persistReducer(persistServicesConfig, servicesSlice.reducer),
    recipes: recipesSlice.reducer,
    [appApi.reducerPath]: appApi.reducer,
  },
  middleware(getDefaultMiddleware) {
    /* eslint-disable unicorn/prefer-spread -- It's not Array#concat, can't use spread */
    return getDefaultMiddleware({
      // See https://github.com/rt2zz/redux-persist/issues/988#issuecomment-654875104
      serializableCheck: {
        ignoredActions: ["persist/PERSIST", "persist/FLUSH"],
      },
    })
      .concat(appApi.middleware)
      .concat(conditionalMiddleware);
    /* eslint-enable unicorn/prefer-spread */
  },
  devTools: REDUX_DEV_TOOLS,
});

export const persistor = persistStore(store);

// https://redux-toolkit.js.org/rtk-query/overview#configure-the-store
// Optional, but required for refetchOnFocus/refetchOnReconnect behaviors see `setupListeners` docs - takes an optional
// callback as the 2nd arg for customization
setupListeners(store.dispatch);

export default store;
