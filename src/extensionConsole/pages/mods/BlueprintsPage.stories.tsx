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

import React from "react";
import { type ComponentStory, type ComponentMeta } from "@storybook/react";
import ModPage from "@/extensionConsole/pages/mods/ModPage";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { authSlice } from "@/auth/authSlice";
import modsSlice from "@/extensionConsole/pages/mods/modsSlice";
import extensionsSlice from "@/store/extensionsSlice";
import { blueprintModalsSlice } from "@/extensionConsole/pages/mods/modals/blueprintModalsSlice";
import { appApi } from "@/services/api";
import { recipesSlice } from "@/recipes/recipesSlice";

export default {
  title: "Blueprints/BlueprintsPage",
  component: ModPage,
} as ComponentMeta<typeof ModPage>;

function optionsStore(initialState?: any) {
  return configureStore({
    reducer: {
      auth: authSlice.reducer,
      blueprints: modsSlice.reducer,
      options: extensionsSlice.reducer,
      blueprintModals: blueprintModalsSlice.reducer,
      recipes: recipesSlice.reducer,
      [appApi.reducerPath]: appApi.reducer,
    },
    middleware(getDefaultMiddleware) {
      /* eslint-disable unicorn/prefer-spread -- It's not Array#concat, can't use spread */
      return getDefaultMiddleware().concat(appApi.middleware);
      /* eslint-enable unicorn/prefer-spread */
    },
    ...(initialState ?? { preloadedState: initialState }),
  });
}

const Template: ComponentStory<typeof ModPage> = (args) => (
  <Provider store={optionsStore()}>
    <ModPage {...args} />
  </Provider>
);

export const Default = Template.bind({});
Default.parameters = {
  // Initial state is a loading state. Our loader is not compatible with Storyshots
  storyshots: false,
};
