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

import { test, expect } from "../../fixtures/extensionBase";
import { ActivateModPage } from "../../pageObjects/extensionConsole/modsPage";
// @ts-expect-error -- https://youtrack.jetbrains.com/issue/AQUA-711/Provide-a-run-configuration-for-Playwright-tests-in-specs-with-fixture-imports-only
import { Page, test as base } from "@playwright/test";
import { getSidebarPage, runModViaQuickBar } from "../../utils";
import { MV, SERVICE_URL } from "../../env";

test("sidebar is persistent during navigation", async ({
  page,
  extensionId,
}) => {
  test.skip(MV === "2", "Navigation is not supported for MV2 sidebar");
  // This mod shows two panels in the sidebar with a simple form. One is enabled for the pbx.vercel.app domain and app
  // domain, and the other is enabled just for the pbx.vercel.app domain.
  const modId = "@e2e-testing/test-sidebar-navigation";

  const modActivationPage = new ActivateModPage(page, extensionId, modId);
  await modActivationPage.goto();

  await modActivationPage.clickActivateAndWaitForModsPageRedirect();

  await page.goto("/");

  // Ensure the page is focused by clicking on an element before running the keyboard shortcut, see runModViaQuickbar
  await page.getByText("Index of  /").click();
  await runModViaQuickBar(page, "Open Sidebar");

  const sideBarPage = (await getSidebarPage(page, extensionId)) as Page; // MV3 sidebar is a separate page
  // Set up close listener for sidebar page
  let sideBarPageClosed = false;
  sideBarPage.on("close", () => {
    sideBarPageClosed = true;
  });

  await expect(
    sideBarPage.getByRole("heading", { name: "Sidebar 2" }), // The panel for Sidebar 2 is the one that is shown (last panel is shown by default)
  ).toBeVisible();
  await expect(
    sideBarPage.getByRole("tab", { name: "Test sidebar 1" }),
  ).toBeVisible();
  await expect(
    sideBarPage.getByRole("tab", { name: "Test sidebar 2" }),
  ).toBeVisible();

  const notesField = sideBarPage.getByLabel("Example Notes Field");
  // The notes field in this mod defaults its value to the current url.
  await expect(notesField).toContainText("https://pbx.vercel.app/");
  await notesField.fill("Something else");

  // Navigate to the "advanced-fields" subpage
  await page.getByRole("link", { name: "advanced-fields" }).click();
  await expect(
    sideBarPage.getByRole("heading", { name: "Sidebar 2" }),
  ).toBeVisible();
  await expect(
    sideBarPage.getByRole("tab", { name: "Test sidebar 1" }),
  ).toBeVisible();
  await expect(
    sideBarPage.getByRole("tab", { name: "Test sidebar 2" }),
  ).toBeVisible();
  // The sidebar resets the state of the panel, so notes field resets its value to the current url.
  await expect(notesField).toContainText(
    "https://pbx.vercel.app/advanced-fields/",
  );

  // Navigating in the browser to another page should keep the sidebar open and reset the state of the panel.
  await page.goto(SERVICE_URL);
  await expect(
    sideBarPage.getByRole("heading", { name: "Sidebar 2" }),
  ).toBeVisible();
  // Sidebar 1 tab is hidden since it is not enabled in this page.
  await expect(
    sideBarPage.getByRole("tab", { name: "Test sidebar 1" }),
  ).not.toBeVisible();
  await expect(
    sideBarPage.getByRole("tab", { name: "Test sidebar 2" }),
  ).toBeVisible();
  await expect(notesField).toContainText(SERVICE_URL);

  // Reloading also works the same way.
  await page.reload();
  await expect(
    sideBarPage.getByRole("heading", { name: "Sidebar 2" }),
  ).toBeVisible();
  await expect(notesField).toContainText(SERVICE_URL);

  // Navigating to a page where all mod sidebar panels are not enabled should close the sidebar since no panels are open.
  await page.getByTestId("sidebarToggler").click();
  await page.getByRole("link", { name: "Documentation" }).click();
  await expect(() => {
    expect(sideBarPageClosed).toBe(true);
  }).toPass({ timeout: 5000 });
});