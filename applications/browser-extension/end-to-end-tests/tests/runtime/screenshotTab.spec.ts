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

import { test, expect } from "../../fixtures/testBase";
import { ActivateModPage } from "../../pageObjects/extensionConsole/modsPage";
// @ts-expect-error -- https://youtrack.jetbrains.com/issue/AQUA-711/Provide-a-run-configuration-for-Playwright-tests-in-specs-with-fixture-imports-only
import { test as base } from "@playwright/test";
import { runModViaQuickBar } from "../../utils";

test("screenshot tab brick functionality", async ({ page, extensionId }) => {
  const modId = "@e2e-testing/test-screenshot";

  const modActivationPage = new ActivateModPage(page, extensionId, modId);
  await modActivationPage.goto();

  await modActivationPage.clickActivateAndWaitForModsPageRedirect();

  await page.goto("/");

  await runModViaQuickBar(page, "Screenshot");

  const screenshotModalFrame = page.frameLocator(
    'iframe[title="Modal content"]',
  );

  await expect(
    screenshotModalFrame.getByText("Screenshot modal"),
  ).toBeVisible();

  await expect(screenshotModalFrame.getByRole("img")).not.toHaveJSProperty(
    "naturalWidth",
    0,
  );
});
