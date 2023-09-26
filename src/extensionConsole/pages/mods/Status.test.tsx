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
import { render, screen } from "@testing-library/react";
import Status from "@/extensionConsole/pages/mods/Status";
import useModsPageActions, {
  type ModsPageActions,
} from "@/extensionConsole/pages/mods/hooks/useModsPageActions";

jest.mock("@/extensionConsole/pages/mods/hooks/useModsPageActions", () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({}),
}));

const useModPageActionsMock = useModsPageActions as jest.MockedFunction<
  typeof useModsPageActions
>;

describe("Status", () => {
  beforeEach(() => {
    useModPageActionsMock.mockReturnValue({} as ModsPageActions);
  });

  it("shows active", async () => {
    const { asFragment } = render(
      <Status
        modViewItem={
          {
            active: true,
          } as any
        }
      />
    );

    expect(screen.getByText("Active")).toBeVisible();
    expect(asFragment()).toMatchSnapshot();
  });

  it("shows activate", async () => {
    useModPageActionsMock.mockReturnValue({
      activate: jest.fn(),
    } as unknown as ModsPageActions);

    const { asFragment } = render(
      <Status
        modViewItem={
          {
            active: true,
          } as any
        }
      />
    );

    expect(screen.getByText("Activate")).toBeVisible();
    expect(asFragment()).toMatchSnapshot();
  });

  it("shows warning for unavailable", async () => {
    const { asFragment } = render(
      <Status
        modViewItem={
          {
            unavailable: true,
          } as any
        }
      />
    );

    expect(screen.getByText("No longer available")).toBeVisible();
    expect(asFragment()).toMatchSnapshot();
  });

  it("paused", async () => {
    const { asFragment } = render(
      <Status
        modViewItem={
          {
            status: "Paused",
          } as any
        }
      />
    );

    expect(screen.getByText("Paused")).toBeVisible();
    expect(asFragment()).toMatchSnapshot();
  });
});
