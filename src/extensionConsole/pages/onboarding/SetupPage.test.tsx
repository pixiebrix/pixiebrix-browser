/*
 * Copyright (C) 2023 PixieBrix, Inc.
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

import React from "react";
import SetupPage from "@/extensionConsole/pages/onboarding/SetupPage";
import { act, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { CONTROL_ROOM_OAUTH_INTEGRATION_ID } from "@/services/constants";
import { HashRouter } from "react-router-dom";
import { createHashHistory } from "history";
import userEvent from "@testing-library/user-event";
import { waitForEffect } from "@/testUtils/testHelpers";
import {
  INTERNAL_reset as resetManagedStorage,
  readManagedStorage,
} from "@/store/enterprise/managedStorage";
import { render } from "@/extensionConsole/testHelpers";
import settingsSlice from "@/store/settings/settingsSlice";
import { mockAnonymousUser, mockCachedUser } from "@/testUtils/userMock";
import { partnerUserFactory } from "@/testUtils/factories/authFactories";
import notify from "@/utils/notify";

// Mock notify to assert success/failure because I was having issues writing assertions over the history.
jest.mock("@/utils/notify", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const notifySuccessMock = jest.mocked(notify.success);

jest.mock("lodash", () => {
  const lodash = jest.requireActual("lodash");
  return {
    ...lodash,
    // Handle multiple calls to managedStorage:initManagedStorage across tests
    once: (fn: any) => fn,
  };
});

// `pMemoize` has problems when used in tests because the promise can leak across tests. pMemoizeClear doesn't work
// because the promise hasn't resolved yet
jest.mock("p-memoize", () => {
  const memoize = jest.requireActual("p-memoize");
  return {
    ...memoize,
    __esModule: true,
    pMemoizeClear: jest.fn(),
    default: jest.fn().mockImplementation((fn) => fn),
  };
});

jest.mock("@/services/baseService", () => ({
  getInstallURL: jest.fn().mockResolvedValue("https://app.pixiebrix.com"),
}));

beforeEach(async () => {
  jest.clearAllMocks();
  resetManagedStorage();
  await browser.storage.managed.clear();
});

describe("SetupPage", () => {
  test("anonymous user with no partner", async () => {
    mockAnonymousUser();

    render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByTestId("loader")).toBeNull();
    });

    expect(screen.queryByText("Connect your AARI account")).toBeNull();
  });

  test("OAuth2 partner user with required service id in settings", async () => {
    mockCachedUser(partnerUserFactory());

    render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>,
      {
        setupRedux(dispatch) {
          dispatch(
            settingsSlice.actions.setAuthIntegrationId({
              integrationId: CONTROL_ROOM_OAUTH_INTEGRATION_ID,
            })
          );
        },
      }
    );

    await waitFor(() => {
      expect(screen.queryByTestId("loader")).toBeNull();
    });

    screen.debug();

    expect(screen.getByText("Connect your AARI account")).not.toBeNull();
  });

  test("Start URL for OAuth2 flow", async () => {
    const user = userEvent.setup();
    mockAnonymousUser();

    location.href =
      "chrome-extension://abc123/options.html#/start?hostname=mycontrolroom.com";

    // Needs to use HashRouter instead of MemoryRouter for the useLocation calls in the components to work correctly
    // given the URL structure above
    render(
      <HashRouter>
        <SetupPage />
      </HashRouter>
    );

    await waitFor(() => {
      expect(screen.queryByTestId("loader")).toBeNull();
    });

    expect(screen.getByText("Connect your AARI account")).not.toBeNull();
    expect(
      screen.getByLabelText("Control Room URL").getAttribute("value")
      // Schema should get pre-pended automatically from hostname
    ).toBe("https://mycontrolroom.com");

    // Sanity check we haven't redirected away from the start screen yet
    expect(location.href).toBe(
      "chrome-extension://abc123/options.html#/start?hostname=mycontrolroom.com"
    );

    const button = screen.getByText("Connect AARI");
    await user.click(button);

    await waitForEffect();

    // Should have redirected away from the start page
    expect(location.href).toBe("chrome-extension://abc123/options.html#/");
  });

  test("Start URL with Community Edition hostname if user is unauthenticated", async () => {
    mockAnonymousUser();

    const history = createHashHistory();
    // Hostname comes as hostname, not URL
    history.push(
      "/start?hostname=community2.cloud-2.automationanywhere.digital"
    );

    // Needs to use HashRouter instead of MemoryRouter for the useLocation calls in the components to work correctly
    // given the URL structure above
    render(
      <HashRouter>
        <SetupPage />
      </HashRouter>
    );

    await waitFor(() => {
      expect(screen.queryByTestId("loader")).toBeNull();
    });

    expect(screen.getByTestId("link-account-btn")).not.toBeNull();
    expect(screen.queryByTestId("connect-aari-token-btn")).toBeNull();
  });

  test("Start URL with Community Edition hostname if authenticated", async () => {
    mockCachedUser(partnerUserFactory());
    const history = createHashHistory();

    // Hostname comes as hostname, not URL
    history.push(
      "/start?hostname=community2.cloud-2.automationanywhere.digital"
    );

    // Needs to use HashRouter instead of MemoryRouter for the useLocation calls in the components to work correctly
    // given the URL structure above
    render(
      <HashRouter>
        <SetupPage />
      </HashRouter>
    );

    await waitFor(() => {
      expect(screen.queryByTestId("loader")).toBeNull();
    });

    expect(screen.queryByTestId("link-account-btn")).toBeNull();
    expect(screen.queryByTestId("connect-aari-token-btn")).toBeVisible();

    expect(screen.getByText("Connect your AARI account")).not.toBeNull();
    expect(
      screen.getByLabelText("Control Room URL").getAttribute("value")
      // Schema get pre-pended automatically
    ).toBe("https://community2.cloud-2.automationanywhere.digital");

    expect(screen.getByLabelText("Username")).not.toBeNull();

    const user = userEvent.setup();

    await act(async () => {
      await user.type(screen.getByLabelText("Username"), "test");
      await user.type(screen.getByLabelText("Password"), "test");
      await user.click(screen.getByTestId("connect-aari-token-btn"));
    });

    expect(notifySuccessMock).toHaveBeenCalledTimes(1);
  });

  test("Managed Storage OAuth2 partner user", async () => {
    const controlRoomUrl = "https://notarealcontrolroom.com";

    mockAnonymousUser();

    await browser.storage.managed.set({
      partnerId: "automation-anywhere",
      controlRoomUrl,
    });

    // XXX: waiting for managed storage initialization seems to be necessary to avoid test interference when
    // run with other tests. We needed to add it after some seemingly unrelated changes:
    // See test suite changes in : https://github.com/pixiebrix/pixiebrix-extension/pull/6134/
    await readManagedStorage();

    render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByTestId("loader")).toBeNull();
    });

    expect(screen.getByText("Connect your AARI account")).not.toBeNull();
    expect(
      screen.getByLabelText("Control Room URL").getAttribute("value")
    ).toStrictEqual(controlRoomUrl);
  });
});
