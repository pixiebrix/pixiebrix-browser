/*
 * Copyright (C) 2024 PixieBrix, Inc.
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
import { render, screen } from "@/sidebar/testHelpers";
import DefaultPanel from "./DefaultPanel";
import extensionsSlice from "@/store/extensionsSlice";
import { type ActivatedModComponent } from "@/types/modComponentTypes";
import { modComponentFactory } from "@/testUtils/factories/modComponentFactories";
import { type Timestamp } from "@/types/stringTypes";
import { appApiMock } from "@/testUtils/appApiMock";
import { waitFor } from "@testing-library/react";

describe("renders DefaultPanel", () => {
  it("renders Page Editor call to action", () => {
    render(<DefaultPanel />);

    expect(screen.getByText("Get started with PixieBrix")).not.toBeNull();
  });

  it("renders restricted user content", async () => {
    appApiMock.onGet("/api/me/").reply(200, {
      flags: ["restricted-marketplace"],
    });

    render(<DefaultPanel />, {
      setupRedux(dispatch) {
        dispatch(
          extensionsSlice.actions.saveModComponent({
            modComponent: {
              ...(modComponentFactory() as ActivatedModComponent),
              updateTimestamp: new Date().toISOString() as Timestamp,
            },
          }),
        );
      },
    });

    await waitFor(async () => {
      expect(
        await screen.findByText("No panels activated for the page"),
      ).toBeVisible();
    });
  });
});
