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

import Cookies from "js-cookie";
import { type ManualStorageKey, readStorage, setStorage } from "@/chrome";
import {
  type PartnerAuthData,
  type TokenAuthData,
  USER_DATA_UPDATE_KEYS,
  type UserData,
  type UserDataUpdate,
} from "./authTypes";
import { isExtensionContext } from "webext-detect-page";
import { expectContext } from "@/utils/expectContext";
import { isEmpty, omit, remove } from "lodash";
import { type UnknownObject } from "@/types";
import { syncRemotePackages } from "@/baseRegistry";

// `chrome.storage.local` keys
const STORAGE_EXTENSION_KEY = "extensionKey" as ManualStorageKey;
const STORAGE_PARTNER_TOKEN = "partnerToken" as ManualStorageKey;

type AuthListener = (auth: Partial<TokenAuthData>) => void;

const listeners: AuthListener[] = [];

// Use listeners to allow inversion of control and avoid circular dependency with rollbar.
export function addListener(handler: AuthListener): void {
  listeners.push(handler);
}

export function removeListener(handler: AuthListener): void {
  remove(listeners, (x) => x === handler);
}

/**
 * Read cached PixieBrix authentication data from local storage.
 */
export async function readAuthData(): Promise<
  TokenAuthData | Partial<TokenAuthData>
> {
  return readStorage(STORAGE_EXTENSION_KEY, {});
}

/**
 * Returns true if the specified flag is on for the current user.
 * @param flag the feature flag to check
 */
export async function flagOn(flag: string): Promise<boolean> {
  const authData = await readAuthData();
  return authData.flags?.includes(flag);
}

/**
 * Return the native PixieBrix API token (issued by the PixieBrix API).
 */
export async function getExtensionToken(): Promise<string | undefined> {
  const { token } = await readAuthData();
  return token;
}

export async function readPartnerAuthData(): Promise<Partial<PartnerAuthData>> {
  return readStorage(STORAGE_PARTNER_TOKEN, {});
}

/**
 * Set authentication data when using the partner JWT to authenticate.
 *
 * @see clearPartnerAuth
 */
export async function setPartnerAuth(data: PartnerAuthData): Promise<void> {
  if (!isEmpty(data.authId) && isEmpty(data.token)) {
    // Should use clearPartnerAuth for clearing the partner integration JWT
    throw new Error("Received null/blank token for partner integration");
  }

  return setStorage(STORAGE_PARTNER_TOKEN, data);
}

/**
 * Clear authentication data when using the partner JWT to authenticate.
 *
 * @see setPartnerAuth
 */
export async function clearPartnerAuth(): Promise<void> {
  return setStorage(STORAGE_PARTNER_TOKEN, {});
}

/**
 * Return PixieBrix API authentication headers, or null if not authenticated.
 *
 * Headers can either be:
 * - Native PixieBrix token
 * - Partner Bearer JWT
 */
export async function getAuthHeaders(): Promise<UnknownObject | null> {
  const [nativeToken, partnerAuth] = await Promise.all([
    getExtensionToken(),
    readPartnerAuthData(),
  ]);

  if (nativeToken) {
    return {
      Authorization: `Token ${nativeToken}`,
    };
  }

  if (partnerAuth?.token) {
    return {
      ...partnerAuth.extraHeaders,
      // Put Authorization second to avoid overriding Authorization header. (Is defensive for now, currently
      // the extra headers are hard-coded)
      Authorization: `Bearer ${partnerAuth.token}`,
    };
  }

  return null;
}

/**
 * Return `true` if the extension is linked to the API.
 *
 * NOTE: do not use this as a check before making an authenticated API call. Instead, use `maybeGetLinkedApiClient`
 * which avoids a race condition between the time the check is made and underlying `getExtensionToken` call to get
 * the token.
 *
 * @see maybeGetLinkedApiClient
 */
export async function isLinked(): Promise<boolean> {
  return (await getAuthHeaders()) != null;
}

/**
 * Return non-sensitive PixieBrix user profile data.
 * @see getExtensionAuth
 */
export async function getUserData(): Promise<Partial<UserData>> {
  expectContext("extension");
  const data = await readAuthData();
  return omit(data, "token");
}

/**
 * Return information about the principal and tenant
 */
export async function getExtensionAuth(): Promise<
  Pick<UserData, "user" | "email" | "hostname">
> {
  expectContext("extension");
  const { user, email, hostname } = await readAuthData();
  return { user, email, hostname };
}

/**
 * Clear the cached extension authentication secrets.
 *
 * The options page will show as "unlinked" and prompt the user to link their account.
 */
export async function clearCachedAuthSecrets(): Promise<void> {
  console.debug("Clearing extension auth");
  await Promise.all([
    browser.storage.local.remove(STORAGE_EXTENSION_KEY),
    browser.storage.local.remove(STORAGE_PARTNER_TOKEN),
  ]);
  Cookies.remove("csrftoken");
  Cookies.remove("sessionid");
}

/**
 * Update user data (for use in Rollbar, etc.), but not the auth token
 *
 * This method is currently used to ensure the most up-to-date organization and flags for the user. It's called in:
 * - The background heartbeat
 * - The getAuth query made by extension pages
 *
 * @see linkExtension
 */
export async function updateUserData(update: UserDataUpdate): Promise<void> {
  const result = await readAuthData();

  for (const key of USER_DATA_UPDATE_KEYS) {
    // Intentionally overwrite values with null/undefined from the update. For some reason TypeScript was complaining
    // about assigning any to never. It's not clear why update[key] was being typed as never
    // eslint-disable-next-line security/detect-object-injection,@typescript-eslint/no-explicit-any -- keys from compile-time constant
    (result[key] as any) = update[key] as any;
  }

  await setStorage(STORAGE_EXTENSION_KEY, result);
}

/**
 * Link the browser extension to the user's PixieBrix account. Return true if the link was updated
 *
 * This method is called (via messenger) when the user visits the app.
 *
 * @see updateUserData
 */
export async function linkExtension(auth: TokenAuthData): Promise<boolean> {
  if (!auth) {
    return false;
  }

  const previous = await readAuthData();

  // Previously we used to check all the data, but that was problematic because it made evolving the data fields tricky.
  // The server would need to change which data it sent based on the version of the extension. There's an interplay
  // between updateUserData and USER_DATA_UPDATE_KEYS and the data set with updateExtensionAuth
  const updated =
    auth.user !== previous.user || auth.hostname !== previous.hostname;

  console.debug(`Setting extension auth for ${auth.email}`, auth);
  await setStorage(STORAGE_EXTENSION_KEY, auth);

  if (previous.user && auth.user && previous.user !== auth.user) {
    // The linked account changed, so their access to packages may have changed
    void syncRemotePackages();
  }

  return updated;
}

if (isExtensionContext()) {
  browser.storage.onChanged.addListener((changes, storage) => {
    if (storage === "local") {
      const change =
        // eslint-disable-next-line security/detect-object-injection -- compile time constants
        changes[STORAGE_EXTENSION_KEY] ?? changes[STORAGE_PARTNER_TOKEN];

      if (change) {
        for (const listener of listeners) {
          listener(change.newValue);
        }
      }
    }
  });
}
