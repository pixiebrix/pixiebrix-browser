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
import {
  type BrowserContext,
  type Locator,
  type Page,
  // @ts-expect-error -- https://youtrack.jetbrains.com/issue/AQUA-711/Provide-a-run-configuration-for-Playwright-tests-in-specs-with-fixture-imports-only
  test as base,
} from "@playwright/test";
import { getSidebarPage } from "../../utils";
import { getBaseExtensionConsoleUrl } from "../../pageObjects/constants";

async function openSidebar(page: Page, extensionId: string) {
  // The mod contains a trigger to open the sidebar on h1. If the sidePanel is already open, it's a NOP
  await page.click("h1");

  const sideBarPage = await getSidebarPage(page, extensionId);

  await expect(
    sideBarPage.getByRole("heading", { name: "Sidebar Links" }),
  ).toBeVisible();

  return sideBarPage;
}

async function reopenSidebarForMSEdge(page: Page, extensionId: string) {
  await page.bringToFront();
  // eslint-disable-next-line playwright/no-wait-for-timeout -- msedge bug
  await page.waitForTimeout(500);
  return openSidebar(page, extensionId);
}

async function clickLinkInSidebarAndWaitForPage(
  context: BrowserContext,
  locator: Locator,
  chromiumChannel: string,
) {
  const pagePromise = context.waitForEvent("page");
  if (chromiumChannel === "msedge") {
    // On MS Edge, opening a new tab closes the sidebar. The click steps fail because MS Edge closes the sidebar when the new tab is opened
    //  Error: locator.click: Target page, context or browser has been closed.
    // Even though it errors, the link is still opened in a new tab.
    // See https://github.com/w3c/webextensions/issues/588.
    await expect(async () => locator.click()).not.toPass({
      timeout: 3000,
    });
  } else {
    await locator.click();
  }

  return pagePromise;
}

test("8206: clicking links doesn't crash browser", async ({
  page,
  context,
  extensionId,
  chromiumChannel,
  baseURL,
}) => {
  const modId = "@pixies/test/sidebar-links";
  const modActivationPage = new ActivateModPage(page, extensionId, modId);
  await modActivationPage.goto();
  await modActivationPage.clickActivateAndWaitForModsPageRedirect();

  await page.goto("/");
  // On MS Edge, opening a new tab closes the sidebar, so we have to re-open it on the page after clicking each link
  // See https://github.com/w3c/webextensions/issues/588.
  let sideBarPage = await openSidebar(page, extensionId);

  await test.step("Clicking extension console link", async () => {
    const extensionConsolePage = await clickLinkInSidebarAndWaitForPage(
      context,
      sideBarPage.getByLabel("Open Extension Console"),
      chromiumChannel,
    );

    expect(extensionConsolePage.url()).toContain(
      getBaseExtensionConsoleUrl(extensionId),
    );

    // eslint-disable-next-line playwright/no-conditional-in-test -- msedge bug
    if (chromiumChannel === "msedge") {
      // Another msedge bug causes the browser to fail to open the extension console page from the sidebar until you refresh the page.
      //   "Error: This script should only be loaded in a browser extension."
      await extensionConsolePage.reload();
    }

    await expect(
      extensionConsolePage.getByText("Extension Console"),
    ).toBeVisible();
  });

  await test.step("Clicking markdown text link", async () => {
    // eslint-disable-next-line playwright/no-conditional-in-test -- msedge bug
    if (chromiumChannel === "msedge") {
      sideBarPage = await reopenSidebarForMSEdge(page, extensionId);
    }

    const markdownTextLinkPage = await clickLinkInSidebarAndWaitForPage(
      context,
      sideBarPage.getByRole("link", { name: "Markdown Text Link" }),
      chromiumChannel,
    );
    expect(markdownTextLinkPage.url()).toBe(`${baseURL}/bootstrap-5/`);
  });

  await test.step("Clicking react bootstrap link", async () => {
    // eslint-disable-next-line playwright/no-conditional-in-test -- msedge bug
    if (chromiumChannel === "msedge") {
      sideBarPage = await reopenSidebarForMSEdge(page, extensionId);
    }

    const reactBootstrapLinkPage = await clickLinkInSidebarAndWaitForPage(
      context,
      sideBarPage.getByRole("button", { name: "Open a Tab Link" }),
      chromiumChannel,
    );
    expect(reactBootstrapLinkPage.url()).toBe(`${baseURL}/bootstrap-5/#gamma`);
  });

  await test.step("Clicking html renderer link", async () => {
    // eslint-disable-next-line playwright/no-conditional-in-test -- msedge bug
    if (chromiumChannel === "msedge") {
      sideBarPage = await reopenSidebarForMSEdge(page, extensionId);
    }

    const htmlRendererLinkPage = await clickLinkInSidebarAndWaitForPage(
      context,
      sideBarPage.getByRole("link", { name: "HTML Renderer Link" }),
      chromiumChannel,
    );
    expect(htmlRendererLinkPage.url()).toBe(`${baseURL}/bootstrap-5/`);
  });

  await test.step("Clicking embedded form link", async () => {
    // eslint-disable-next-line playwright/no-conditional-in-test -- msedge bug
    if (chromiumChannel === "msedge") {
      sideBarPage = await reopenSidebarForMSEdge(page, extensionId);
    }

    const embeddedFormLinkPage = await clickLinkInSidebarAndWaitForPage(
      context,
      sideBarPage.getByRole("link", { name: "Embedded Form Link" }),
      chromiumChannel,
    );
    expect(embeddedFormLinkPage.url()).toBe(`${baseURL}/bootstrap-5/#beta`);
  });

  // Clicking link in IFrame will crash MS Edge until the issue is fixed
  // https://github.com/microsoft/MicrosoftEdge-Extensions/issues/145
  // eslint-disable-next-line playwright/no-conditional-in-test -- see above comment
  if (chromiumChannel !== "msedge") {
    await test.step("Clicking link in IFrame", async () => {
      // PixieBrix uses 2 layers of frames to get around the host page CSP. Test page has 2 layers
      const pixiebrixFrame = sideBarPage.frameLocator("iframe").first();
      const mainFrame = pixiebrixFrame.frameLocator("iframe").first();
      // eslint-disable-next-line playwright/no-conditional-expect -- see above
      await expect(mainFrame.getByText("Alpha")).toBeVisible();

      const srcdocFrame = mainFrame.frameLocator("iframe").first();
      await srcdocFrame.getByRole("link", { name: "IFrame Link" }).click();
    });
  }
});
