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

import { showModActivationInSidebar } from "@/contentScript/sidebarController";
import { initSidebarActivation } from "@/contentScript/sidebarActivation";
import { getActivatedModIds } from "@/store/extensionsStorage";
import { getDocument } from "@/starterBricks/starterBrickTestUtils";
import { validateRegistryId } from "@/types/helpers";
import { type ActivatedModComponent } from "@/types/modComponentTypes";
import { waitForEffect } from "@/testUtils/testHelpers";
import { getActivatingMods } from "@/background/messenger/external/_implementation";
import {
  modComponentFactory,
  modMetadataFactory,
} from "@/testUtils/factories/modComponentFactories";
import {
  loadActivationEnhancements,
  TEST_unloadActivationEnhancements,
} from "@/contentScript/loadActivationEnhancementsCore";
import { getContentScriptState } from "@/contentScript/ready";
import { isLinked } from "@/auth/authStorage";
import { array } from "cooky-cutter";
import { MARKETPLACE_URL } from "@/urlConstants";
import { type RegistryId } from "@/types/registryTypes";

jest.mock("@/contentScript/sidebarController", () => ({
  ...jest.requireActual("@/contentScript/sidebarController"),
  showSidebar: jest.fn(),
  showModActivationInSidebar: jest.fn(),
}));

jest.mock("@/auth/authStorage", () => ({
  isLinked: jest.fn().mockResolvedValue(true),
  addListener: jest.fn(),
}));

const isLinkedMock = jest.mocked(isLinked);

jest.mock("@/contentScript/ready");
jest.mock("@/store/extensionsStorage");
jest.mock("@/background/messenger/external/_implementation");
jest.mock("@/sidebar/store");

const showSidebarMock = jest.mocked(showModActivationInSidebar);
const getActivatedModIdsMock = jest.mocked(getActivatedModIds);
const getActivatingModsMock = jest.mocked(getActivatingMods);

const modId1 = validateRegistryId("@pixies/misc/comment-and-vote");
const modId2 = validateRegistryId("@pixies/github/github-notifications");

const activateButtonsHtml = `
<div>
    <a class="btn btn-primary" data-activate-button href="https://app.pixiebrix.com/activate?id=${encodeURIComponent(
      modId1,
    )}&utm_source=marketplace&utm_campaign=activate_blueprint" target="_blank" rel="noreferrer noopener"><i class="fas fa-plus-circle"></i> Activate</a>
    <a class="btn btn-primary" data-activate-button href="https://app.pixiebrix.com/activate?id=${encodeURIComponent(
      modId2,
    )}&utm_source=marketplace&utm_campaign=activate_blueprint" target="_blank" rel="noreferrer noopener"><i class="fas fa-plus-circle"></i> Activate</a>
</div>
`;

describe("marketplace enhancements", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.body.innerHTML = getDocument(activateButtonsHtml).body.innerHTML;
    jest.mocked(getContentScriptState).mockImplementation(() => "ready");
    getActivatedModIdsMock.mockResolvedValue(new Set());
    getActivatingModsMock.mockResolvedValue([]);
  });

  afterEach(async () => {
    jest.resetAllMocks();
    TEST_unloadActivationEnhancements();
  });

  test("given user is logged in, when an activate button is clicked, should open the sidebar", async () => {
    isLinkedMock.mockResolvedValue(true);
    window.location.assign(MARKETPLACE_URL);
    // Recipe 1 is installed, recipe 2 is not
    const modComponent1 = modComponentFactory({
      _recipe: modMetadataFactory({
        id: modId1,
      }),
    }) as ActivatedModComponent;
    const modComponent2 = modComponentFactory() as ActivatedModComponent;
    getActivatedModIdsMock.mockResolvedValue(
      new Set<RegistryId | undefined>([
        modComponent1._recipe?.id,
        modComponent2._recipe?.id,
      ]),
    );

    await loadActivationEnhancements();
    await initSidebarActivation();

    // Click an activate button
    const activateButtons = document.querySelectorAll("a");
    activateButtons[0]!.click();
    await waitForEffect();

    // The current page should not navigate away from the marketplace
    expect(window.location.href).toBe(MARKETPLACE_URL);
    // The show-sidebar function should be called
    expect(showSidebarMock).toHaveBeenCalledOnce();
  });

  test("multiple mod activation on non-detail page", async () => {
    isLinkedMock.mockResolvedValue(true);
    window.location.assign("https://www.pixiebrix.com/");

    const components = array(
      modComponentFactory,
      2,
    )({
      _recipe: modMetadataFactory,
    });

    const modIds = components.map((x) => x._recipe?.id);

    document.body.innerHTML = `
    <div>
        <a class="btn btn-primary" data-activate-button href="https://app.pixiebrix.com/activate?id=${encodeURIComponent(
          modIds[0]!,
        )}&id=${modIds[1]}">Click Me!</a>
    </div>`;

    getActivatedModIdsMock.mockResolvedValue(new Set());

    await loadActivationEnhancements();
    await initSidebarActivation();

    // Sanity check for test interference
    expect(showSidebarMock).not.toHaveBeenCalledOnce();

    // Click an activate button
    const activateButton = document.querySelector("a");
    activateButton!.click();
    await waitForEffect();

    expect(window.location.href).toBe("https://www.pixiebrix.com/");
    // The show-sidebar function should be called
    expect(showSidebarMock).toHaveBeenCalledExactlyOnceWith({
      heading: "Activating",
      mods: modIds.map((id) => ({ modId: id, initialOptions: {} })),
    });
  });

  test("given user is not logged in, when activation button clicked, open admin console", async () => {
    isLinkedMock.mockResolvedValue(false);
    window.location.assign(MARKETPLACE_URL);

    await loadActivationEnhancements();
    await initSidebarActivation();

    // Click an activate button
    const activateButtons = document.querySelectorAll("a");
    activateButtons[0]!.click();
    await waitForEffect();

    // User is not logged in, so current page should navigate away from marketplace
    expect(window.location).not.toBeAt(MARKETPLACE_URL);
  });

  test("given user is not logged in, when loaded, then don't resume activation in progress", async () => {
    isLinkedMock.mockResolvedValue(false);
    window.location.assign(MARKETPLACE_URL);

    await initSidebarActivation();

    // Before loading in-progress recipe activation, isUserLoggedIn is called,
    // which calls isLinked
    expect(isLinkedMock).toHaveBeenCalledTimes(1);
    // The getInstalledRecipeIds function should not call loadOptions
    // when the user is not logged in
    expect(getActivatedModIdsMock).not.toHaveBeenCalled();
    // The marketplace script should not resume in-progress blueprint
    // activation when the user is not logged in
    expect(getActivatingModsMock).not.toHaveBeenCalled();
  });

  test("given user is not logged in, when loaded, should change button text", async () => {
    isLinkedMock.mockResolvedValue(false);
    window.location.assign(MARKETPLACE_URL);
    // Recipe 1 is installed, recipe 2 is not
    const modComponent1 = modComponentFactory({
      _recipe: modMetadataFactory({
        id: modId1,
      }),
    }) as ActivatedModComponent;
    const modComponent2 = modComponentFactory() as ActivatedModComponent;
    getActivatedModIdsMock.mockResolvedValue(
      new Set([modComponent1._recipe?.id, modComponent2._recipe?.id]),
    );

    await loadActivationEnhancements();
    await initSidebarActivation();

    const activateButtons = document.querySelectorAll("a");
    // Text content starts with a space because of the icon
    expect(activateButtons[0]!.textContent).toBe("Reactivate");
    expect(activateButtons[1]!.textContent).toBe(" Activate");
  });

  test("given user is logged in, when loaded, should change button text for installed recipe", async () => {
    isLinkedMock.mockResolvedValue(true);
    window.location.assign(MARKETPLACE_URL);
    // Recipe 1 is installed, recipe 2 is not
    const modComponent1 = modComponentFactory({
      _recipe: modMetadataFactory({
        id: modId1,
      }),
    }) as ActivatedModComponent;
    const modComponent2 = modComponentFactory() as ActivatedModComponent;
    getActivatedModIdsMock.mockResolvedValue(
      new Set([modComponent1._recipe?.id, modComponent2._recipe?.id]),
    );

    await loadActivationEnhancements();
    await initSidebarActivation();

    const activateButtons = document.querySelectorAll("a");
    expect(activateButtons[0]!.textContent).toBe("Reactivate");
    expect(activateButtons[1]!.textContent).toBe(" Activate");
  });

  test("given user is logged in, when loaded, should resume activation in progress", async () => {
    isLinkedMock.mockResolvedValue(true);
    window.location.assign(MARKETPLACE_URL);

    await loadActivationEnhancements();
    await initSidebarActivation();

    // Before loading in-progress recipe activation, isUserLoggedIn is called,
    // which calls getAuthHeaders
    expect(isLinkedMock).toHaveBeenCalledTimes(1);
    // The getInstalledRecipeIds function should call loadOptions
    // when the user is logged in
    expect(getActivatedModIdsMock).toHaveBeenCalledOnce();
    // The marketplace script should resume in-progress blueprint
    // activation when the user is logged in
    expect(getActivatingModsMock).toHaveBeenCalledOnce();
  });
});
