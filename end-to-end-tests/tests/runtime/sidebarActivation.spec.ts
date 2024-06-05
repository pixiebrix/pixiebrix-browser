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
import { getSidebarPage } from "../../utils";
// @ts-expect-error -- https://youtrack.jetbrains.com/issue/AQUA-711/Provide-a-run-configuration-for-Playwright-tests-in-specs-with-fixture-imports-only
import { type Page, test as base } from "@playwright/test";

/**
 * Convert an existing link element on the page into a mod activation link
 * @param page the page on which to run the script
 * @param nextUrl the url to which to redirect after activation
 */
const insertActivationLink = async (page: Page, nextUrl: string) => {
  await page.addInitScript((nextUrl: string) => {
    window.addEventListener("DOMContentLoaded", () => {
      const linkElement = document.createElement("a");
      linkElement.setAttribute(
        "href",
        `http://app.pixiebrix.com/activate?id=%40misha-holtz%2Freverse-gitlink&nextUrl=${nextUrl}`,
      );
      linkElement.innerHTML = "Activate mod";
      linkElement.setAttribute("id", "activation-link");
      document.body.append(linkElement);
    });
  }, nextUrl);
};

test("initiates sidebar mod activation from activate url click", async ({
  page,
  extensionId,
}) => {
  const redirectUrl = "https://www.pixiebrix.com/";
  await insertActivationLink(page, redirectUrl);
  await page.goto("/");
  await page.locator("#activation-link").click();

  const sidebarPage = await getSidebarPage(page, extensionId);

  await expect(sidebarPage.getByText("Activating")).toBeVisible();
  await expect(sidebarPage.getByText("Reverse GitLink")).toBeVisible();
  expect(page.url()).toBe(redirectUrl);
});

test("does not redirect to non-pixiebrix domain", async ({
  page,
  extensionId,
}) => {
  const invalidRedirectUrl = "https://pbx.vercel.app/";
  await page.goto("/");
  await insertActivationLink(page, "a[href*='#alpha']", invalidRedirectUrl);
  await page.getByText("Alpha").click();
  await page.waitForURL("https://app.pixiebrix.com/*");

  // TODO: sidebarpage shouldn't open in this case
  const sidebarPage = await getSidebarPage(page, extensionId);

  await expect(sidebarPage.getByText("Activating")).toBeVisible();
  await expect(sidebarPage.getByText("Reverse GitLink")).toBeVisible();
  expect(page.url()).toBe("https://www.pixiebrix.com/");
});
