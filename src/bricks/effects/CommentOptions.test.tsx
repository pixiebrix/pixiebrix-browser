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
import { render } from "@/pageEditor/testHelpers";
import CommentOptions from "@/bricks/effects/CommentOptions";
import registerDefaultWidgets from "@/components/fields/schemaFields/widgets/registerDefaultWidgets";
import { screen } from "@testing-library/react";

beforeAll(() => {
  registerDefaultWidgets();
});

describe("CommentOptions", () => {
  it("renders a comment in a textarea", async () => {
    render(<CommentOptions name="test" configKey="test" />, {
      initialValues: {
        test: {
          test: {
            comment: "this is a comment",
          },
        },
      },
    });

    expect(screen.getByLabelText("Comment")).toBeInTheDocument();

    expect(screen.getByRole("textbox", { name: "Comment" })).toHaveValue(
      "this is a comment",
    );
  });
});
