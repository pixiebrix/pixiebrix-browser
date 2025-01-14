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

import { type Page, expect } from "@playwright/test";
import { getBaseExtensionConsoleUrl } from "../../constants";
import { EditWorkshopModPage } from "end-to-end-tests/pageObjects/extensionConsole/workshop/editWorkshopModPage";
import { CreateWorkshopModPage } from "./createWorkshopModPage";
import { BasePageObject } from "../../basePageObject";

export class WorkshopPage extends BasePageObject {
  private readonly workshopUrl: string;

  createNewPackageButton = this.getByRole("button", {
    name: "Create New Package",
  });

  constructor(page: Page, extensionId: string) {
    super(page);
    this.workshopUrl = `${getBaseExtensionConsoleUrl(extensionId)}#/workshop`;
  }

  async goto() {
    await this.page.goto(this.workshopUrl);
  }

  async findAndSelectMod(modId: string) {
    await this.getByPlaceholder("Start typing to find results").fill(modId);
    await this.getByRole("cell", { name: modId }).waitFor();
    await this.getByRole("cell", { name: modId }).click();

    const editPage = new EditWorkshopModPage(this.page);
    await editPage.editor.waitForLoad();
    return editPage;
  }

  async createNewModFromDefinition(modDefinitionName: string) {
    await this.createNewPackageButton.click();
    const createPage = new CreateWorkshopModPage(this.page);
    await createPage.editor.waitForLoad();
    const modMedata =
      await createPage.editor.replaceWithModDefinition(modDefinitionName);
    await createPage.createBrickButton.click();
    await expect(this.getByRole("status").getByText("Created ")).toBeVisible();
    return modMedata;
  }

  async deleteModByModId(modId: string) {
    const editWorkshopModPage = await this.findAndSelectMod(modId);
    await editWorkshopModPage.deleteBrick();
  }
}
