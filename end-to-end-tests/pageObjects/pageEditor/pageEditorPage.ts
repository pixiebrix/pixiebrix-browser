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

import { getBasePageEditorUrl } from "../constants";
import { type Page, expect, type Locator } from "@playwright/test";
import { ModsPage } from "../extensionConsole/modsPage";
import { WorkshopPage } from "../extensionConsole/workshop/workshopPage";
import { type UUID } from "@/types/stringTypes";
import { BasePageObject } from "../basePageObject";
import { ModListingPanel } from "./modListingPanel";
import { BrickActionsPanel } from "./brickActionsPanel";
import { ConfigurationForm } from "./configurationForm";
import { DataPanel } from "./dataPanel";
import { ModEditorPane } from "./modEditorPane";
import { ModifiesModFormState } from "./utils";
import { CreateModModal } from "./createModModal";
import { DeactivateModModal } from "end-to-end-tests/pageObjects/pageEditor/deactivateModModal";
import { uuidv4 } from "@/types/helpers";

class EditorPane extends BasePageObject {
  editTab = this.getByRole("tab", { name: "Edit" });

  runTriggerButton = this.getByRole("button", { name: "Run Trigger" });
  autoRunTrigger = this.getSwitchByLabel("Auto-Run");

  renderPanelButton = this.getByRole("button", {
    name: "Render Panel",
  });

  autoRenderPanel = this.getSwitchByLabel("Auto-Render");

  brickActionsPanel = new BrickActionsPanel(
    this.getByTestId("brickActionsPanel"),
  );

  brickConfigurationPanel = new ConfigurationForm(
    this.getByTestId("brickConfigurationPanel"),
  );

  dataPanel = new DataPanel(this.getByTestId("dataPanel"));
}
/**
 * Page object for the Page Editor. Prefer the newPageEditorPage fixture in testBase.ts to directly creating an
 * instance of this class to take advantage of automatic cleanup of saved mods.
 */
export class PageEditorPage extends BasePageObject {
  private readonly pageEditorUrl: string;
  private readonly savedPackageModIds: string[] = [];

  modListingPanel = new ModListingPanel(this.getByTestId("modListingPanel"));

  modEditorPane = new ModEditorPane(this.getByTestId("modEditorPane"));

  editorPane = new EditorPane(this.getByTestId("editorPane"));
  brickActionsPanel = this.editorPane.brickActionsPanel;
  brickConfigurationPanel = this.editorPane.brickConfigurationPanel;
  dataPanel = this.editorPane.dataPanel;

  templateGalleryButton = this.getByRole("button", {
    name: "Launch Template Gallery",
  });

  constructor(
    page: Page,
    private readonly urlToConnectTo: string,
    private readonly extensionId: string,
  ) {
    super(page);
    this.pageEditorUrl = getBasePageEditorUrl(extensionId);
  }

  async goto() {
    await this.page.goto(this.pageEditorUrl);
    // Set the viewport size to the expected in horizontal layout size of the devconsole when docked on the bottom.
    await this.page.setViewportSize({ width: 1280, height: 600 });
    await this.getByTestId(`tab-${this.urlToConnectTo}`).click();
    const heading = this.getByRole("heading", {
      name: "Welcome to the Page Editor!",
    });
    await expect(heading).toBeVisible();
  }

  async bringToFront() {
    await this.page.bringToFront();
  }

  /** Used for interactions that require selecting an element on the connected page, such as the button starter brick */
  @ModifiesModFormState
  async selectConnectedPageElement(selectLocator: Locator) {
    const connectedPage = selectLocator.page();
    await connectedPage.bringToFront();
    await expect(
      connectedPage.getByText("Selection Tool: 0 matching"),
    ).toBeVisible();
    await selectLocator.click();

    await this.page.bringToFront();
  }

  /**
   * Save the current active mod
   */
  async saveActiveMod() {
    // TODO: this method is currently meant for mods that aren't meant to be
    //  cleaned up after the test. Future work is adding affordance to clean up saved packaged
    //  mods, with an option to avoid cleanup for certain mods.
    await this.modListingPanel.activeModListItem.saveButton.click();
    await expect(
      this.page.getByRole("status").filter({ hasText: "Saved mod" }),
    ).toBeVisible();
  }

  getRenderPanelButton() {
    return this.getByRole("button", { name: "Render Panel" });
  }

  getIncrementVersionErrorToast() {
    return this.getByText(
      "Cannot overwrite version of a published brick. Increment the version",
    );
  }

  /**
   * Save a new mod with the given name and optional description.
   *
   * @param currentModName the current name (not registry id) of the mod to save
   * @param descriptionOverride the optional description override
   * @returns the RegistryId of the saved mod
   */
  @ModifiesModFormState
  async saveNewMod({
    currentModName,
    descriptionOverride,
  }: {
    currentModName: string;
    descriptionOverride?: string;
  }): Promise<{
    modId: string;
  }> {
    const modListItem =
      this.modListingPanel.getModListItemByName(currentModName);
    await modListItem.select();
    // Expect the mod metadata editor to be showing form for a mod that's never been saved before
    await expect(
      this.modEditorPane.editMetadataTabPanel.getByPlaceholder(
        "Save the mod to assign a Mod ID",
      ),
    ).toBeVisible();

    const saveNewModModal = this.page.locator(".modal-content");
    // The save button re-mounts several times so we need to retry clicking the saveButton until the modal is visible
    await expect(async () => {
      await modListItem.saveButton.click();
      await expect(saveNewModModal).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 20_000 });

    await expect(saveNewModModal.getByText("Save new mod")).toBeVisible();
    // // Can't use getByLabel to target because the field is composed of multiple widgets
    const registryIdInput = saveNewModModal.getByTestId("registryId-id-id");
    const currentId = await registryIdInput.inputValue();
    // Add a random uuid to the mod id to prevent test collisions
    await registryIdInput.fill(`${currentId}-${uuidv4()}`);

    if (descriptionOverride) {
      // Update the mod description
      // TODO: https://github.com/pixiebrix/pixiebrix-extension/issues/9238, prefer getByLabel
      const descriptionInput = saveNewModModal.locator("#description");
      await descriptionInput.fill(descriptionOverride);
    }

    // Click the Save button in the modal
    await saveNewModModal.getByRole("button", { name: "Save" }).click();

    // Wait for the save confirmation
    await expect(
      this.page
        .getByRole("status")
        .filter({ hasText: "Mod created successfully" }),
    ).toBeVisible();

    const modId =
      await this.modEditorPane.editMetadataTabPanel.modId.inputValue();

    return { modId };
  }

  /**
   * Create a new mod by moving a mod component to a new mod.
   * @param sourceModComponentName the name of the mod component to move
   * @param destinationModName the root name of the new mod (to avoid test data collision, a unique string is appended
   * to this root name, see CreateModModal)
   */
  @ModifiesModFormState
  async moveModComponentToNewMod({
    sourceModComponentName,
    destinationModName,
  }: {
    sourceModComponentName: string;
    destinationModName: string;
  }) {
    const modListItem = this.modListingPanel.getModListItemByName(
      sourceModComponentName,
    );
    await modListItem.menuButton.click();
    await this.getByRole("menuitem", { name: "Move to Mod" }).click();

    const moveDialog = this.getByRole("dialog");

    await moveDialog.getByRole("combobox").click();
    await moveDialog.getByRole("option", { name: /Create new mod.../ }).click();
    await moveDialog.getByRole("button", { name: "Move" }).click();

    // Create mod modal is shown
    const createModModal = new CreateModModal(this.getByRole("dialog"));

    const modId = await createModModal.createMod(destinationModName);
    return { modId };
  }

  /**
   * Create a new mod by copying a mod component to a new mod.
   * @param sourceModComponentName the name of the mod component to move
   * @param destinationModName the root name of the new mod (to avoid test data collision, a unique string is appended
   * to this root name, see CreateModModal)
   */
  @ModifiesModFormState
  async copyModComponentToNewMod({
    sourceModComponentName,
    destinationModName,
  }: {
    sourceModComponentName: string;
    destinationModName: string;
  }) {
    const modListItem = this.modListingPanel.getModListItemByName(
      sourceModComponentName,
    );
    await modListItem.menuButton.click();
    await this.getByRole("menuitem", { name: "Copy to Mod" }).click();

    const moveDialog = this.getByRole("dialog");

    await moveDialog.getByRole("combobox").click();
    await moveDialog.getByRole("option", { name: /Create new mod.../ }).click();
    await moveDialog.getByRole("button", { name: "Copy" }).click();

    // Create mod modal is shown
    const createModModal = new CreateModModal(this.getByRole("dialog"));

    const modId = await createModModal.createMod(destinationModName);
    return { modId };
  }

  @ModifiesModFormState
  async copyMod(modName: string, modUuid: UUID) {
    const modListItem = this.modListingPanel.getModListItemByName(modName);
    await modListItem.select();

    await modListItem.menuButton.click();
    const actionMenu = modListItem.modActionMenu;
    await actionMenu.copyButton.click();

    const createModModal = new CreateModModal(this.getByRole("dialog"));
    const modId = await createModModal.copyMod(modName, modUuid);

    this.savedPackageModIds.push(modId);
  }

  async deactivateMod(modName: string) {
    const modListItem = this.modListingPanel.getModListItemByName(modName);
    await modListItem.select();

    await modListItem.menuButton.click();
    const actionMenu = modListItem.modActionMenu;
    await actionMenu.deactivateButton.click();

    const deactivateModModal = new DeactivateModModal(this.getByRole("dialog"));
    await deactivateModModal.deactivateButton.click();
  }

  /**
   * This method is meant to be called exactly once after the test is done to clean up any saved mods created during the
   * test.
   *
   * @see newPageEditorPage in fixtures/testBase.ts
   */
  async cleanup() {
    const modsPage = new ModsPage(this.page, this.extensionId);
    await modsPage.goto();

    const workshopPage = new WorkshopPage(this.page, this.extensionId);
    await workshopPage.goto();
    for (const packagedModId of this.savedPackageModIds) {
      await workshopPage.deletePackagedModByModId(packagedModId);
    }
  }
}
