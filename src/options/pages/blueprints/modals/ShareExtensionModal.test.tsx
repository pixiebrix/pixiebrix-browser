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

import React from "react";
import { render, screen } from "@testing-library/react";
import ShareExtensionModal from "./ShareExtensionModal";
import { extensionFactory } from "@/tests/factories";
import { waitForEffect } from "@/tests/testHelpers";
import userEvent from "@testing-library/user-event";
import { Organization } from "@/types/contract";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import extensionsSlice from "@/store/extensionsSlice";
import { PersistedExtension } from "@/core";
import settingsSlice from "@/store/settingsSlice";
import { anonAuth } from "@/auth/authConstants";
import { authSlice } from "@/auth/authSlice";

jest.unmock("react-redux");

jest.mock("@/utils/notify");
jest.mock("@/services/api", () => ({
  useGetOrganizationsQuery: () => ({ data: [] as Organization[] }),
  useGetMeQuery: () => ({ refetch: jest.fn() }),
}));

const extension = extensionFactory({
  label: "testExtension",
});

const renderShareExtensionModal = (state?: any) => {
  const store = configureStore({
    reducer: {
      auth: authSlice.reducer,
      options: extensionsSlice.reducer,
      settings: settingsSlice.reducer,
    },
    preloadedState: {
      auth: anonAuth,
      options: { extensions: [extension as PersistedExtension] },
      ...state,
    },
  });

  return render(
    <Provider store={store}>
      <ShareExtensionModal extensionId={extension.id} />
    </Provider>
  );
};

test("renders modal", async () => {
  renderShareExtensionModal({
    auth: {
      ...anonAuth,
      scope: "@test",
    },
  });
  await waitForEffect();

  const dialogRoot = screen.getByRole("dialog");
  expect(dialogRoot).toMatchSnapshot();
});

test("requires user scope", async () => {
  renderShareExtensionModal();
  await waitForEffect();

  // Scope input field is on the screen
  const scopeInput = await screen.findAllByLabelText("Account Alias");
  expect(scopeInput).not.toBeNull();

  // Screen matches the snapshot
  const dialogRoot = screen.getByRole("dialog");
  expect(dialogRoot).toMatchSnapshot();
});

test("prints 'Convert' when not Public (default)", async () => {
  renderShareExtensionModal({
    auth: {
      ...anonAuth,
      scope: "@test",
    },
  });
  await waitForEffect();

  const dialogRoot = screen.getByRole("dialog");
  const publicSwitch = dialogRoot.querySelector(
    ".form-group:nth-child(5) .switch.btn"
  );
  expect(publicSwitch).toHaveClass("off");
  const submitButton = dialogRoot.querySelector('.btn[type="submit"]');
  expect(submitButton.textContent).toBe("Convert");
});

test("prints 'Share' when Public", async () => {
  renderShareExtensionModal({
    auth: {
      ...anonAuth,
      scope: "@test",
    },
  });
  await waitForEffect();

  const dialogRoot = screen.getByRole("dialog");
  const publicSwitch = dialogRoot.querySelector(
    ".form-group:nth-child(5) .switch.btn"
  );
  userEvent.click(publicSwitch);
  expect(publicSwitch).toHaveClass("on");
  const submitButton = dialogRoot.querySelector('.btn[type="submit"]');
  expect(submitButton.textContent).toBe("Share");
});
