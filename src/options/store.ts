/*
 * Copyright (C) 2022 PixieBrix, Inc.
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

import { configureStore, Middleware } from "@reduxjs/toolkit";
import { persistReducer, persistStore } from "redux-persist";
import { createLogger } from "redux-logger";
import { connectRouter, routerMiddleware } from "connected-react-router";
import { createHashHistory } from "history";
import { boolean } from "@/utils";
import { ExtensionsRootState } from "@/store/extensionsTypes";
import servicesSlice, {
  persistServicesConfig,
  ServicesState,
} from "@/store/servicesSlice";
import {
  blueprintModalsSlice,
  BlueprintModalsState,
} from "./pages/blueprints/modals/blueprintModalsSlice";
import { appApi } from "@/services/api";
import { setupListeners } from "@reduxjs/toolkit/dist/query/react";
import extensionsSlice from "@/store/extensionsSlice";
import settingsSlice from "@/store/settingsSlice";
import workshopSlice, {
  persistWorkshopConfig,
  WorkshopState,
} from "@/store/workshopSlice";
import { persistExtensionOptionsConfig } from "@/store/extensionsStorage";
import { persistSettingsConfig } from "@/store/settingsStorage";
import { SettingsState } from "@/store/settingsTypes";
import blueprintsSlice, {
  persistBlueprintsConfig,
} from "./pages/blueprints/blueprintsSlice";
import { logSlice } from "@/components/logViewer/logSlice";
import { LogRootState } from "@/components/logViewer/logViewerTypes";
import { AuthRootState } from "@/auth/authTypes";
import { authSlice, persistAuthConfig } from "@/auth/authSlice";
import { BlueprintsRootState } from "@/options/pages/blueprints/blueprintsSelectors";
import { recipesSlice } from "@/recipes/recipesSlice";
import { recipesMiddleware } from "@/recipes/recipesListenerMiddleware";

const REDUX_DEV_TOOLS: boolean = boolean(process.env.REDUX_DEV_TOOLS);

export const hashHistory = createHashHistory({ hashType: "slash" });

export type RootState = AuthRootState &
  LogRootState &
  BlueprintsRootState &
  ExtensionsRootState & {
    services: ServicesState;
    settings: SettingsState;
    workshop: WorkshopState;
    blueprintModals: BlueprintModalsState;
  };

const conditionalMiddleware: Middleware[] = [];
if (typeof createLogger === "function") {
  // Allow tree shaking of logger in production
  // https://github.com/LogRocket/redux-logger/issues/6
  conditionalMiddleware.push(
    createLogger({
      // Do not log polling actions (they happen too often)
      predicate: (getState, action) => !action.type.includes("logs/polling"),
    })
  );
}

const store = configureStore({
  reducer: {
    router: connectRouter(hashHistory),
    auth: persistReducer(persistAuthConfig, authSlice.reducer),
    options: persistReducer(
      persistExtensionOptionsConfig,
      extensionsSlice.reducer
    ),
    blueprints: persistReducer(
      persistBlueprintsConfig,
      blueprintsSlice.reducer
    ),
    services: persistReducer(persistServicesConfig, servicesSlice.reducer),
    // XXX: settings and workshop use the same persistor config?
    settings: persistReducer(persistSettingsConfig, settingsSlice.reducer),
    workshop: persistReducer(persistWorkshopConfig, workshopSlice.reducer),
    blueprintModals: blueprintModalsSlice.reducer,
    logs: logSlice.reducer,
    recipes: recipesSlice.reducer,
    [appApi.reducerPath]: appApi.reducer,
  },
  middleware(getDefaultMiddleware) {
    /* eslint-disable unicorn/prefer-spread -- use .concat for proper type inference */
    return getDefaultMiddleware({
      // See https://github.com/rt2zz/redux-persist/issues/988#issuecomment-654875104
      serializableCheck: {
        ignoredActions: ["persist/PERSIST", "persist/FLUSH"],
      },
    })
      .concat(appApi.middleware)
      .concat(recipesMiddleware)
      .concat(routerMiddleware(hashHistory))
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
