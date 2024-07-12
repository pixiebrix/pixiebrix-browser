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
import { ActivateModPage } from "../../pageObjects/extensionConsole/modsPage";
import { type PageEditorPage } from "end-to-end-tests/pageObjects/pageEditor/pageEditorPage";

const testModDefinitionName = "brick-actions";
const otherTestMod = "simple-sidebar-panel";
test.use({ modDefinitionNames: [testModDefinitionName, otherTestMod] });
test("brick actions panel behavior", async ({
  page,
  extensionId,
  modDefinitionsMap,
  newPageEditorPage,
  verifyModDefinitionSnapshot,
}) => {
  const { id: modId } = modDefinitionsMap[testModDefinitionName];
  const { id: otherModId } = modDefinitionsMap[otherTestMod];
  let pageEditorPage: PageEditorPage;

  await test.step("Activate mods, and initialize page editor", async () => {
    let modActivationPage = new ActivateModPage(page, extensionId, modId);
    await modActivationPage.goto();
    await modActivationPage.clickActivateAndWaitForModsPageRedirect();
    modActivationPage = new ActivateModPage(page, extensionId, otherModId);
    await modActivationPage.goto();
    await modActivationPage.clickActivateAndWaitForModsPageRedirect();

    await page.goto("/");
    pageEditorPage = await newPageEditorPage(page.url());
  });

  const { brickActionsPanel } = pageEditorPage;
  await test.step("Select the mod in the page editor and verify brick actions panel is hidden", async () => {
    const modListItem =
      pageEditorPage.modListingPanel.getModListItemByName("Mod Actions Test");
    await modListItem.select();
    await expect(brickActionsPanel.root).toBeHidden();
  });

  await test.step("Select the starter brick and verify brick actions panel is visible", async () => {
    const testStarterBrick = pageEditorPage.modListingPanel.getModStarterBrick(
      "Mod Actions Test",
      "Button",
    );
    await testStarterBrick.select();
    await expect(brickActionsPanel.root).toBeVisible();
  });

  await test.step("Add a new brick", async () => {
    await brickActionsPanel.addBrick("Set Mod Variable", { index: 1 });
    await pageEditorPage.saveActiveMod();
    await verifyModDefinitionSnapshot({ modId, snapshotName: "brick-added" });
  });

  await test.step("Remove a brick", async () => {
    await brickActionsPanel.getBrickByName("Set Mod Variable").select();
    await brickActionsPanel.removeBrickButton.click();
    await pageEditorPage.saveActiveMod();
    await verifyModDefinitionSnapshot({ modId, snapshotName: "brick-removed" });
  });

  await test.step("Copy and paste a brick", async () => {
    await brickActionsPanel.getBrickByName("Alert Brick").select();
    await expect(brickActionsPanel.getPasteBrickButton(0)).toBeHidden();
    await brickActionsPanel.copyActiveBrick();
    await brickActionsPanel.pasteBrick(1);
    await expect(brickActionsPanel.getPasteBrickButton(0)).toBeHidden();
    await pageEditorPage.saveActiveMod();
    await verifyModDefinitionSnapshot({
      modId,
      snapshotName: "brick-copy-pasted",
    });
  });

  await test.step("Move bricks", async () => {
    await brickActionsPanel.getBrickByName("Custom Modal").moveDown();
    await brickActionsPanel.getBrickByName("Assign Mod Var Brick").moveUp();
    await pageEditorPage.saveActiveMod();
    await verifyModDefinitionSnapshot({ modId, snapshotName: "bricks-moved" });
  });

  await test.step("Copy a brick from one mod to another", async () => {
    const targetModId = modDefinitionsMap[otherTestMod].id;

    await brickActionsPanel.getBrickByName("Assign Mod Var Brick").select();
    await brickActionsPanel.copyActiveBrick();

    // Switch to the other mod, and select its starter brick
    await pageEditorPage.modListingPanel
      .getModListItemByName("Simple Sidebar Panel")
      .select();
    await pageEditorPage.modListingPanel
      .getModStarterBrick("Simple Sidebar Panel", "Simple Sidebar Panel")
      .select();

    await brickActionsPanel.pasteBrick(1);
    await pageEditorPage.saveActiveMod();
    await verifyModDefinitionSnapshot({
      modId: targetModId,
      snapshotName: "brick-copied-to-another-mod",
    });
  });
});
