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
import { render } from "@testing-library/react";
import React from "react";
import { Provider } from "react-redux";
import LogCard from "./LogCard";
import { initialLogState, logSlice } from "./logSlice";
import { type LogState } from "./logViewerTypes";

function renderLogCard(state?: LogState) {
  // @ts-expect-error -- assigning state with collections of LogEntries is perfectly fine
  const store = configureStore({
    reducer: {
      logs: logSlice.reducer,
    },
    preloadedState:
      state == null
        ? undefined
        : {
            logs: state,
          },
  });

  return render(
    <Provider store={store}>
      <LogCard />
    </Provider>
  );
}

test("shows loader", () => {
  const rendered = renderLogCard({
    ...initialLogState,
    isLoading: true,
  });

  expect(rendered.getByTestId("loader")).toBeInTheDocument();
});

test("renders empty table", () => {
  const rendered = renderLogCard();

  expect(rendered.asFragment()).toMatchSnapshot();
});
