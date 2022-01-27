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

import browser from "webextension-polyfill";
import Cookies from "js-cookie";
import { updateAuth as updateRollbarAuth } from "@/telemetry/rollbar";
import { isEqual } from "lodash";
import { ManualStorageKey, readStorage, setStorage } from "@/chrome";

const STORAGE_EXTENSION_KEY = "extensionKey" as ManualStorageKey;

interface UserData {
  email?: string;
  user?: string;
  hostname?: string;
  organizationId?: string;
  telemetryOrganizationId?: string;
}

export interface AuthData extends UserData {
  token: string;
}

export async function readAuthData(): Promise<AuthData | Partial<AuthData>> {
  return readStorage(STORAGE_EXTENSION_KEY, {});
}

export async function getExtensionToken(): Promise<string | undefined> {
  const { token } = await readAuthData();
  return token;
}

/**
 * Return `true` if the extension is linked to the API.
 *
 * NOTE: do not use this as a check before making an authenticated API call. Instead use `maybeGetLinkedApiClient` which
 * avoids a race condition between the time the check is made and underlying `getExtensionToken` call to get the token.
 *
 * @see maybeGetLinkedApiClient
 */
export async function isLinked(): Promise<boolean> {
  return (await getExtensionToken()) != null;
}

export async function getExtensionAuth(): Promise<UserData> {
  const { user, email, hostname } = await readAuthData();
  return { user, email, hostname };
}

export async function clearExtensionAuth(): Promise<void> {
  await browser.storage.local.remove(STORAGE_EXTENSION_KEY);
  Cookies.remove("csrftoken");
  Cookies.remove("sessionid");
}

/**
 * Refresh the Chrome extensions auth (user, email, token, API hostname), and return true if it was updated.
 */
export async function updateExtensionAuth(
  auth: AuthData & { browserId: string }
): Promise<boolean> {
  if (!auth) {
    return false;
  }

  void updateRollbarAuth({
    userId: auth.user,
    email: auth.email,
    organizationId: auth.telemetryOrganizationId ?? auth.organizationId,
    browserId: auth.browserId,
  });

  // Note: `auth` is a `Object.create(null)` object, which for some `isEqual` implementations
  // isn't deeply equal to `{}`.  _.isEqual is fine, `fast-deep-equal` isn't
  // https://github.com/pixiebrix/pixiebrix-extension/pull/1016
  if (isEqual(auth, await readAuthData())) {
    // The auth hasn't changed
    return false;
  }

  console.debug(`Setting extension auth for ${auth.email}`, auth);
  await setStorage(STORAGE_EXTENSION_KEY, auth);
  return true;
}
