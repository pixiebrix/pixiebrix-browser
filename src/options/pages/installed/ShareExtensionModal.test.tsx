/*
 * Copyright (C) 2021 PixieBrix, Inc.
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
import ShareExtensionModal from "./ShareExtensionModal";
import { extensionFactory } from "@/tests/factories";
import { waitForEffect } from "@/tests/testHelpers";
import userEvent from "@testing-library/user-event";

test.skip("renders modal", async () => {
  render(
    <ShareExtensionModal
      extension={extensionFactory({
        label: "testExtension",
      })}
      onCancel={jest.fn()}
    />
  );
  await waitForEffect();
  const dialogRoot = screen.getByRole("dialog");
  expect(dialogRoot).toMatchSnapshot();
});

test.skip("prints 'Convert' when not Public", async () => {
  render(
    <ShareExtensionModal
      extension={extensionFactory({
        label: "testExtension",
      })}
      onCancel={jest.fn()}
    />
  );
  await waitForEffect();
  const dialogRoot = screen.getByRole("dialog");
  const publicSwitch = dialogRoot.querySelector(
    ".form-group:nth-child(5) .switch.btn"
  );
  userEvent.click(publicSwitch);
  const submitButton = dialogRoot.querySelector('.btn[type="submit"]');
  expect(submitButton.textContent).toBe("Convert");
});
