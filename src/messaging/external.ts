/*
 * Copyright (C) 2020 Pixie Brix, LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * API for PixieBrix app to talk to the browser extension.
 */
import { AuthData, updateExtensionAuth } from "@/auth/token";
import { openOptions } from "@/chrome";
import { liftBackground } from "@/background/protocol";
import { detect } from "detect-browser";
import { liftExternal } from "@/contentScript/externalProtocol";

const browser = detect();

function lift<R>(
  type: string,
  method: (...args: unknown[]) => Promise<R>
): (...args: unknown[]) => Promise<R> {
  const chromeMethod = liftBackground(type, method);
  const browserMethod = liftExternal(type, method);

  return async (...args: unknown[]) => {
    switch (browser.name) {
      case "chrome": {
        // @ts-ignore: liftBackground is being inferred as signature with no arguments
        return await chromeMethod(...args);
      }
      default: {
        // @ts-ignore: liftExternal is being inferred as signature with no arguments
        return await browserMethod(...args);
      }
    }
  };
}

export const connectPage = lift("CONNECT_PAGE", async () => {
  return chrome.runtime.getManifest();
});

export const setExtensionAuth = lift(
  "SET_EXTENSION_AUTH",
  async (auth: AuthData) => {
    return await updateExtensionAuth(auth);
  }
);

// chrome.runtime.openOptionsPage only available from the background page
const _openOptions = liftBackground("OPEN_OPTIONS", async () => {
  await openOptions();
  return true;
});

export const openExtensionOptions = lift("OPEN_OPTIONS", async () => {
  return await _openOptions();
});
