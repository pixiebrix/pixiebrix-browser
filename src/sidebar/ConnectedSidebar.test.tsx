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

import React from "react";
import ConnectedSidebar from "@/sidebar/ConnectedSidebar";
import { render } from "@/sidebar/testHelpers";
import { authActions } from "@/auth/authSlice";
import { authStateFactory } from "@/testUtils/factories";
import { waitForEffect } from "@/testUtils/testHelpers";
import { useGetMeQuery } from "@/services/api";
import { anonAuth } from "@/auth/authConstants";
import { MemoryRouter } from "react-router";

jest.mock("@/store/optionsStore", () => ({
  persistor: {
    flush: jest.fn(),
  },
}));
jest.mock("@/services/api", () => ({
  useGetMeQuery: jest.fn(),
  appApi: {
    reducerPath: "appApi",
  },
}));
jest.mock("@/auth/token", () => {
  const originalModule = jest.requireActual("@/auth/token");
  return {
    ...originalModule,
    isLinked: jest.fn().mockResolvedValue(true),
  };
});
browser.runtime.getURL = (path: string) =>
  `chrome-extension://example.url/${path}`;

beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.runAllTimers();
  jest.useRealTimers();
});

describe("SidebarApp", () => {
  test("renders not connected", async () => {
    (useGetMeQuery as jest.Mock).mockReturnValue({
      isLoading: false,
      data: anonAuth,
    });

    const rendered = render(
      <MemoryRouter>
        <ConnectedSidebar />
      </MemoryRouter>
    );
    await waitForEffect();

    jest.runAllTimers();
    expect(rendered.asFragment()).toMatchSnapshot();
  });

  test("renders not connected partner view", async () => {
    (useGetMeQuery as jest.Mock).mockReturnValue({
      isLoading: false,
      data: {
        partner: {},
        ...anonAuth,
      },
    });

    const rendered = render(
      <MemoryRouter>
        <ConnectedSidebar />
      </MemoryRouter>
    );
    await waitForEffect();

    jest.runAllTimers();
    expect(rendered.asFragment()).toMatchSnapshot();
  });

  test("renders", async () => {
    (useGetMeQuery as jest.Mock).mockReturnValue({
      isLoading: false,
      data: authStateFactory(),
    });

    const rendered = render(
      <MemoryRouter>
        <ConnectedSidebar />
      </MemoryRouter>,
      {
        setupRedux(dispatch) {
          dispatch(authActions.setAuth(authStateFactory()));
        },
      }
    );

    await waitForEffect();

    jest.runAllTimers();
    expect(rendered.asFragment()).toMatchSnapshot();
  });
});
