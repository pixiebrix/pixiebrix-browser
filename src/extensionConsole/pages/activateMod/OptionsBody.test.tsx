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
import { render, screen } from "@/extensionConsole/testHelpers";
import OptionsBody from "@/extensionConsole/pages/activateMod/OptionsBody";
import registerDefaultWidgets from "@/components/fields/schemaFields/widgets/registerDefaultWidgets";

beforeAll(() => {
  registerDefaultWidgets();
});

describe("Marketplace Activate Wizard OptionsBody", () => {
  it("renders a text field", async () => {});

  test("renders text field", async () => {
    const { asFragment } = render(
      <OptionsBody
        mod={{
          options: {
            schema: {
              properties: {
                textField: {
                  title: "Text Field",
                  type: "string",
                },
              },
            },
          },
        }}
      />,
      {
        initialValues: {
          optionsArgs: {},
        },
      },
    );

    await expect(screen.findByText("Text Field")).resolves.toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });
});
