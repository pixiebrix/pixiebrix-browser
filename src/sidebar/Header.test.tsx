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
import { screen } from "@testing-library/react";
import { render } from "@/sidebar/testHelpers";
import Header from "@/sidebar/Header";
import { MemoryRouter } from "react-router";
import { useGetMeQuery } from "@/services/api";
import { waitForEffect } from "@/testUtils/testHelpers";

jest.mock("@/options/store", () => ({
  persistor: {
    flush: jest.fn(),
  },
}));

jest.mock("@/services/api", () => ({
  useGetMeQuery: jest.fn(() => ({
    isLoading: false,
    data: [],
  })),
  appApi: {
    reducerPath: "appApi",
  },
}));

describe("Header", () => {
  it("renders", () => {
    const rendered = render(<Header />);

    expect(rendered.asFragment()).toMatchSnapshot();
    expect(screen.getByTestId("sidebarHeaderLogo")).not.toBeNull();
  });

  it("renders sidebar header logo per organization theme", async () => {
    (useGetMeQuery as jest.Mock).mockImplementation(() => ({
      isLoading: false,
      data: {
        organization: {
          theme: {
            show_sidebar_logo: true,
          },
        },
      },
    }));

    const rendered = render(<Header />);

    await waitForEffect();

    expect(rendered.asFragment()).toMatchSnapshot();
    expect(screen.getByTestId("sidebarHeaderLogo")).not.toBeNull();
  });

  it("renders no sidebar header logo per organization theme", () => {
    (useGetMeQuery as jest.Mock).mockImplementation(() => ({
      isLoading: false,
      data: {
        organization: {
          theme: {
            show_sidebar_logo: false,
          },
        },
      },
    }));

    render(<Header />);

    expect(screen.queryByTestId("sidebarHeaderLogo")).toBeNull();
  });
});
