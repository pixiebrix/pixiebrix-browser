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

import { createFormikTemplate } from "@/testUtils/formHelpers";
import { render, screen } from "@testing-library/react";
import { type FormikValues } from "formik";
import React, { useRef } from "react";
import AdvancedLinks, {
  DEFAULT_TEMPLATE_ENGINE_VALUE,
  DEFAULT_WINDOW_VALUE,
} from "./AdvancedLinks";

const BLOCK_FIELD_NAME = "block";

describe("Advanced options", () => {
  function renderAdvancedLinks(blockConfig: FormikValues) {
    const FormikTemplate = createFormikTemplate({
      [BLOCK_FIELD_NAME]: blockConfig,
    });

    const ComponentUnderTest = () => {
      const scrollToRef = useRef<HTMLElement>();
      return (
        <FormikTemplate>
          <AdvancedLinks name={BLOCK_FIELD_NAME} scrollToRef={scrollToRef} />
        </FormikTemplate>
      );
    };

    return render(<ComponentUnderTest />);
  }

  test.each([
    {},
    {
      templateEngine: DEFAULT_TEMPLATE_ENGINE_VALUE,
    },
    {
      window: DEFAULT_WINDOW_VALUE,
    },
  ])("doesn't show advanced links by default", (blockConfig) => {
    renderAdvancedLinks(blockConfig);

    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  test.each([
    [
      {
        templateEngine: "nunjucks",
      },
      "Template Engine: nunjucks",
    ],
    [
      {
        if: "true",
      },
      "Condition: true",
    ],
    [
      {
        window: "target",
      },
      "Target: Target Tab",
    ],
  ])("shows changed advanced options", (blockConfig, expectedOptionText) => {
    renderAdvancedLinks(blockConfig);

    expect(
      screen.getByRole("button", { name: expectedOptionText })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});
