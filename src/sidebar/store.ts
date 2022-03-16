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
import { createHashHistory } from "history";
import { boolean } from "@/utils";
import { OptionsState } from "@/store/extensionsTypes";
import { appApi } from "@/services/api";
import { setupListeners } from "@reduxjs/toolkit/dist/query/react";
import extensionsSlice from "@/store/extensionsSlice";
import { persistExtensionOptionsConfig } from "@/store/extensionsStorage";
import { logActions } from "@/components/logViewer/logSlice";
import { LogRootState } from "@/components/logViewer/logViewerTypes";

const REDUX_DEV_TOOLS: boolean = boolean(process.env.REDUX_DEV_TOOLS);

export const hashHistory = createHashHistory({ hashType: "slash" });

export type RootState = LogRootState & {
  options: OptionsState;
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
    options: persistReducer(
      persistExtensionOptionsConfig,
      extensionsSlice.reducer
    ),
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

void store.dispatch(logActions.pollLogs());

export default store;
