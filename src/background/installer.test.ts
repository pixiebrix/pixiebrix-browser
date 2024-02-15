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

import {
  requirePartnerAuth,
  openInstallPage,
  handleInstall,
} from "@/background/installer";
import * as auth from "@/auth/token";
import { locator } from "@/background/locator";
import { uuidv4 } from "@/types/helpers";
import { waitForEffect } from "@/testUtils/testHelpers";
import { INTERNAL_reset as resetManagedStorage } from "@/store/enterprise/managedStorage";

const APP_BASE_URL = "https://app.pixiebrix.com";

jest.mock("@/services/baseService", () => ({
  // Can't use APP_BASE_URL because it's not defined yet when Jest defines the mock
  getBaseURL: jest.fn().mockResolvedValue("https://app.pixiebrix.com"),
}));

jest.mock("@/auth/token", () => ({
  isLinked: jest.fn().mockResolvedValue(false),
  getExtensionToken: jest.fn().mockResolvedValue(null),
  getUserData: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/store/syncFlags", () => ({
  syncFlagOn: jest.fn().mockResolvedValue(false),
}));

jest.mock("@/background/locator", () => ({
  locator: {
    locateAllForService: jest.fn().mockResolvedValue([]),
  },
}));

const createTabMock = jest.mocked(browser.tabs.create);
const updateTabMock = jest.mocked(browser.tabs.update);
const queryTabsMock = jest.mocked(browser.tabs.query);
const isLinkedMock = jest.mocked(auth.isLinked);
const getExtensionTokenMock = jest.mocked(auth.getExtensionToken);
const getUserData = jest.mocked(auth.getUserData);
const locateAllForServiceMock = jest.mocked(locator.locateAllForService);
const browserManagedStorageMock = jest.mocked(browser.storage.managed.get);

afterEach(() => {
  jest.clearAllMocks();
  resetManagedStorage();
});

describe("openInstallPage", () => {
  it("Redirects Admin Console tab for native PixieBrix setup flow", async () => {
    queryTabsMock.mockResolvedValue([
      {
        id: 1,
        url: `${APP_BASE_URL}/setup`,
      },
    ] as any);
    await openInstallPage();
    expect(updateTabMock).toHaveBeenCalledWith(1, {
      url: APP_BASE_URL,
      active: true,
    });
    expect(createTabMock.mock.calls).toHaveLength(0);
  });

  it("Opens Extension Console in same tab for enterprise partner", async () => {
    queryTabsMock.mockResolvedValue([
      {
        id: 1,
        url: `${APP_BASE_URL}/start?hostname=enterprise.com`,
      },
    ] as any);
    await openInstallPage();
    expect(updateTabMock).toHaveBeenCalledWith(1, {
      url: "chrome-extension://abcxyz/options.html#/start?hostname=enterprise.com",
      active: true,
    });
    expect(createTabMock.mock.calls).toHaveLength(0);
  });

  it("Opens Admin Console in same tab for community partner", async () => {
    queryTabsMock.mockResolvedValue([
      {
        id: 1,
        url: `${APP_BASE_URL}/start?hostname=community2.cloud-2.automationanywhere.digital`,
      },
    ] as any);
    await openInstallPage();
    expect(updateTabMock).toHaveBeenCalledWith(1, {
      url: APP_BASE_URL,
      active: true,
    });
    expect(createTabMock.mock.calls).toHaveLength(0);
  });

  it("Opens new Extension Console tab if no Admin Console onboarding tab found", async () => {
    queryTabsMock.mockResolvedValue([]);
    await openInstallPage();
    expect(createTabMock).toHaveBeenCalledWith({ url: APP_BASE_URL });
    expect(updateTabMock.mock.calls).toHaveLength(0);
  });
});

describe("checkPartnerAuth", () => {
  it("skips if not linked", async () => {
    isLinkedMock.mockResolvedValue(false);

    await requirePartnerAuth();

    expect(createTabMock.mock.calls).toHaveLength(0);
    expect(updateTabMock.mock.calls).toHaveLength(0);
  });

  it("skip if no partner", async () => {
    isLinkedMock.mockResolvedValue(true);
    getExtensionTokenMock.mockResolvedValue("abc123");
    getUserData.mockResolvedValue({
      partner: null,
    });

    await requirePartnerAuth();

    expect(createTabMock.mock.calls).toHaveLength(0);
    expect(updateTabMock.mock.calls).toHaveLength(0);
  });

  it("skip if partner JWT install", async () => {
    isLinkedMock.mockResolvedValue(true);
    getExtensionTokenMock.mockResolvedValue(null);
    getUserData.mockResolvedValue({
      partner: {
        id: uuidv4(),
        theme: "automation-anywhere",
      },
    } as any);

    await requirePartnerAuth();

    expect(createTabMock.mock.calls).toHaveLength(0);
    expect(updateTabMock.mock.calls).toHaveLength(0);
  });

  it("opens extension console if linked with partner and no services", async () => {
    queryTabsMock.mockResolvedValue([]);
    isLinkedMock.mockResolvedValue(true);
    getExtensionTokenMock.mockResolvedValue("abc123");
    locateAllForServiceMock.mockResolvedValue([
      // Include a cloud configuration to clarify that local integration is still required
      { id: uuidv4(), serviceId: "automation-anywhere", proxy: true } as any,
    ]);
    getUserData.mockResolvedValue({
      partner: {
        id: uuidv4(),
        theme: "automation-anywhere",
      },
    } as any);

    await requirePartnerAuth();

    expect(createTabMock.mock.calls).toHaveLength(1);
    expect(createTabMock).toHaveBeenCalledWith({
      url: "chrome-extension://abcxyz/options.html",
    });
    expect(updateTabMock.mock.calls).toHaveLength(0);
  });

  it("opens extension console in same tab if linked with partner and no services and extension console open", async () => {
    queryTabsMock.mockResolvedValue([
      {
        id: 1,
        url: APP_BASE_URL,
      },
    ] as any);
    isLinkedMock.mockResolvedValue(true);
    getExtensionTokenMock.mockResolvedValue("abc123");
    getUserData.mockResolvedValue({
      partner: {
        id: uuidv4(),
        theme: "automation-anywhere",
      },
    } as any);

    await requirePartnerAuth();

    expect(createTabMock.mock.calls).toHaveLength(0);
    expect(updateTabMock.mock.calls).toHaveLength(1);
    expect(updateTabMock).toHaveBeenCalledWith(1, {
      url: "chrome-extension://abcxyz/options.html",
      active: true,
    });
  });

  it("does not open extension console if integration is configured", async () => {
    queryTabsMock.mockResolvedValue([]);
    isLinkedMock.mockResolvedValue(true);
    getExtensionTokenMock.mockResolvedValue("abc123");
    locateAllForServiceMock.mockResolvedValue([
      { id: uuidv4(), serviceId: "automation-anywhere" } as any,
    ]);
    getUserData.mockResolvedValue({
      partner: {
        id: uuidv4(),
        theme: "automation-anywhere",
      },
    } as any);

    await requirePartnerAuth();

    expect(createTabMock.mock.calls).toHaveLength(0);
    expect(updateTabMock.mock.calls).toHaveLength(0);
  });
});

describe("handleInstall", () => {
  test("it opens extension console if not linked on CWS install", async () => {
    // App setup tab isn't open
    queryTabsMock.mockResolvedValue([]);
    isLinkedMock.mockResolvedValue(false);
    await handleInstall({
      reason: "install",
      previousVersion: undefined,
      temporary: false,
    });
    await waitForEffect();
    expect(createTabMock).toHaveBeenCalledWith({ url: APP_BASE_URL });
  });

  test("don't open tab on install if linked", async () => {
    // App setup tab isn't open
    queryTabsMock.mockResolvedValue([]);
    isLinkedMock.mockResolvedValue(true);
    await handleInstall({
      reason: "install",
      previousVersion: undefined,
      temporary: false,
    });
    expect(createTabMock).not.toHaveBeenCalled();
  });

  test.each([undefined, "https://sso.com"])(
    "don't open tab on install if disableLoginTab is set: %s",
    async (ssoUrl) => {
      browserManagedStorageMock.mockResolvedValue({
        disableLoginTab: true,
        ssoUrl,
      });
      queryTabsMock.mockResolvedValue([]);
      isLinkedMock.mockResolvedValue(false);
      await handleInstall({
        reason: "install",
        previousVersion: undefined,
        temporary: false,
      });
      expect(createTabMock).not.toHaveBeenCalled();
    },
  );
});
