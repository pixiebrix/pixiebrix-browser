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

import { expect, test } from "../../fixtures/extensionBase";
// @ts-expect-error -- https://youtrack.jetbrains.com/issue/AQUA-711/Provide-a-run-configuration-for-Playwright-tests-in-specs-with-fixture-imports-only
import { test as base } from "@playwright/test";
import {
  ActivateModPage,
  ModsPage,
} from "../../pageObjects/extensionConsole/modsPage";

test("can save a standalone trigger mod", async ({
  page,
  extensionId,
  newPageEditorPage,
}) => {
  await page.goto("/");
  const pageEditorPage = await newPageEditorPage(page.url());
  const modName = await pageEditorPage.addStarterBrick("Trigger");
  await pageEditorPage.saveStandaloneMod(modName);
  const modsPage = new ModsPage(page, extensionId);
  await modsPage.goto();
  await expect(
    page.locator(".list-group-item", { hasText: modName }),
  ).toBeVisible();
});

test("shows error notification when updating a public mod without incrementing the version", async ({
  page,
  newPageEditorPage,
  extensionId,
}) => {
  const modId = "@e2e-testing/8203-repro";
  const modName = "8203 Repro";
  const modActivationPage = new ActivateModPage(page, extensionId, modId);
  await modActivationPage.goto();
  await modActivationPage.clickActivateAndWaitForModsPageRedirect();
  await page.goto("/");
  const pageEditorPage = await newPageEditorPage(page.url());
  const modListItem = pageEditorPage.getModListItemByName(modName);
  await modListItem.click();
  await pageEditorPage.fillInBrickField("Name", "8203 Repro Updated");
  await pageEditorPage.savePackagedMod();
  await expect(
    pageEditorPage.getByText(
      "Cannot overwrite version of a published brick. Increment the version",
    ),
  ).toBeVisible();
});
