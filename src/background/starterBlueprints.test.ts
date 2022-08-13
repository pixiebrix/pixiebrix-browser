/*
 * Copyright (C) 2022 PixieBrix, Inc.
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

import { installStarterBlueprints } from "@/background/starterBlueprints";
import { loadOptions, saveOptions } from "@/store/extensionsStorage";
import MockAdapter from "axios-mock-adapter";
import axios from "axios";
import { isLinked } from "@/auth/token";
import { extensionFactory } from "@/testUtils/factories";
import { PersistedExtension } from "@/core";

browser.permissions.contains = jest.fn().mockResolvedValue(true);

const axiosMock = new MockAdapter(axios);

jest.mock("@/permissions", () => ({
  deploymentPermissions: jest
    .fn()
    .mockResolvedValue({ permissions: [], origins: [] }),
}));

jest.mock("@/auth/token", () => ({
  getExtensionToken: async () => "TESTTOKEN",
  readAuthData: jest.fn().mockResolvedValue({
    organizationId: "00000000-00000000-00000000-00000000",
  }),
  isLinked: jest.fn().mockResolvedValue(true),
  async updateUserData() {},
}));

jest.mock("@/background/util", () => ({
  forEachTab: jest.fn().mockResolvedValue(undefined),
}));

const isLinkedMock = isLinked as jest.Mock;
const containsPermissionsMock = browser.permissions.contains as jest.Mock;
const openPlaygroundPage = browser.tabs.create as jest.Mock;

beforeEach(async () => {
  jest.resetModules();

  // Reset local options state
  await saveOptions({
    extensions: [],
  });

  isLinkedMock.mockClear();
  containsPermissionsMock.mockClear();
  openPlaygroundPage.mockClear();
});

describe("installStarterBlueprints", () => {
  test("user has starter blueprints", async () => {
    isLinkedMock.mockResolvedValue(true);
    containsPermissionsMock.mockResolvedValue(true);

    axiosMock.onGet().reply(200, [
      {
        updated_at: "",
        extensionPoints: [{ id: "1234" }],
        sharing: {},
      },
    ]);

    axiosMock.onPost().reply(204);

    await installStarterBlueprints();
    const { extensions } = await loadOptions();

    expect(extensions.length).toBe(1);
    expect(openPlaygroundPage.mock.calls).toHaveLength(1);
  });

  test("user does not have starter blueprints", async () => {
    isLinkedMock.mockResolvedValue(true);
    containsPermissionsMock.mockResolvedValue(true);

    axiosMock.onGet().reply(200, []);

    axiosMock.onPost().reply(204);

    await installStarterBlueprints();
    const { extensions } = await loadOptions();

    expect(extensions.length).toBe(0);
    expect(openPlaygroundPage.mock.calls).toHaveLength(0);
  });

  test("starter blueprints request fails", async () => {
    isLinkedMock.mockResolvedValue(true);
    containsPermissionsMock.mockResolvedValue(true);

    axiosMock.onGet().reply(500);

    axiosMock.onPost().reply(204);

    await installStarterBlueprints();
    const { extensions } = await loadOptions();

    expect(extensions.length).toBe(0);
    expect(openPlaygroundPage.mock.calls).toHaveLength(0);
  });

  test("starter blueprints installation request fails", async () => {
    isLinkedMock.mockResolvedValue(true);
    containsPermissionsMock.mockResolvedValue(true);

    axiosMock.onGet().reply(200);

    axiosMock.onPost().reply(500);

    await installStarterBlueprints();
    const { extensions } = await loadOptions();

    expect(extensions.length).toBe(0);
    expect(openPlaygroundPage.mock.calls).toHaveLength(0);
  });

  test("blueprint already installed", async () => {
    isLinkedMock.mockResolvedValue(true);
    containsPermissionsMock.mockResolvedValue(true);

    const extension = extensionFactory() as PersistedExtension;
    await saveOptions({
      extensions: [extension],
    });

    axiosMock.onGet().reply(200, [
      {
        updated_at: "",
        extensionPoints: [{ id: "1234", _recipe: extension._recipe }],
        sharing: {},
      },
    ]);

    axiosMock.onPost().reply(204);

    await installStarterBlueprints();
    const { extensions } = await loadOptions();

    expect(extensions.length).toBe(1);
    expect(openPlaygroundPage.mock.calls).toHaveLength(0);
  });
});
