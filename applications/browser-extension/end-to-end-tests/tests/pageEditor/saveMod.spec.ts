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

import { expect, test } from "../../fixtures/testBase";
// @ts-expect-error -- https://youtrack.jetbrains.com/issue/AQUA-711/Provide-a-run-configuration-for-Playwright-tests-in-specs-with-fixture-imports-only
import { test as base } from "@playwright/test";
import {
  ActivateModPage,
  ModsPage,
} from "../../pageObjects/extensionConsole/modsPage";

test("can save a new trigger mod", async ({
  page,
  extensionId,
  newPageEditorPage,
}) => {
  await page.goto("/");
  const pageEditorPage = await newPageEditorPage(page.url());
  await pageEditorPage.modListingPanel.addNewMod({
    starterBrickName: "Trigger",
  });
  await pageEditorPage.brickConfigurationPanel.fillField(
    "name",
    "Test trigger mod component",
  );
  const modName = "New Mod";
  await pageEditorPage.saveNewMod({
    currentModName: modName,
    descriptionOverride: "Created by playwright test",
  });
  const modsPage = new ModsPage(page, extensionId);
  await modsPage.goto();

  await expect(
    modsPage.locator(".list-group-item", { hasText: modName }),
  ).toBeVisible();
});

test("#9349: can save new mod with multiple components", async ({
  page,
  newPageEditorPage,
}) => {
  await page.goto("/");
  const pageEditorPage = await newPageEditorPage(page.url());
  await pageEditorPage.modListingPanel.addNewMod({
    starterBrickName: "Trigger",
  });
  await pageEditorPage.brickConfigurationPanel.fillField(
    "name",
    "First Trigger",
  );

  const modName = "New Mod";

  const modListItem =
    pageEditorPage.modListingPanel.getModListItemByName("New Mod");
  await modListItem.select();
  await modListItem.menuButton.click();
  await modListItem.modActionMenu.addStarterBrick("Trigger");

  await pageEditorPage.brickConfigurationPanel.fillField(
    "name",
    "Second Trigger",
  );

  await pageEditorPage.saveNewMod({
    currentModName: modName,
    // This test is verifying the UI state after saving with the mod component selected
    selectModListItem: false,
  });

  // Mod Component should still be selected because the user never selected the mod item
  const modComponentItem =
    pageEditorPage.modListingPanel.getModListItemByName("Second Trigger");
  await expect(modComponentItem.root).toBeVisible();
  await expect(modComponentItem.root).toHaveClass(/active/);

  // Expect the first mod component is also within the expanded mod item
  await expect(
    pageEditorPage.modListingPanel.getModListItemByName("First Trigger").root,
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
  const modListItem =
    pageEditorPage.modListingPanel.getModListItemByName(modName);
  await modListItem.select();
  await pageEditorPage.modEditorPane.editMetadataTabPanel.fillField(
    "name",
    "8203 Repro Updated",
  );
  await pageEditorPage.modListingPanel.activeModListItem.saveButton.click();

  const saveDialog = pageEditorPage.getByRole("dialog");
  await expect(saveDialog).toBeVisible();
  await saveDialog.getByRole("textbox", { name: "New Version" }).fill("1.0.0");
  await saveDialog
    .getByRole("textbox", { name: "Message" })
    .fill("Commit message");
  await saveDialog.getByRole("button", { name: "Save" }).click();

  await expect(pageEditorPage.getIncrementVersionErrorToast()).toBeVisible();
});
