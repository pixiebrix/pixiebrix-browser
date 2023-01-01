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

import { forbidContext } from "@/utils/expectContext";
import { type JsonValue } from "type-fest";
import { type UnknownObject } from "@/types";

// eslint-disable-next-line prefer-destructuring -- It breaks EnvironmentPlugin
const CHROME_EXTENSION_ID = process.env.CHROME_EXTENSION_ID;
const CHROME_EXTENSION_STORAGE_KEY = "chrome_extension_id";

/**
 * A storage key managed manually (i.e., not using redux-persist).
 * @see ReduxStorageKey
 */
export type ManualStorageKey = string & {
  _manualStorageKeyBrand: never;
};

/**
 * A storage key managed by redux-persist. Should begin with the `persist:` prefix
 * @see ManualStorageKey
 */
export type ReduxStorageKey = string & {
  _reduxStorageKeyBrand: never;
};

export function setChromeExtensionId(extensionId = ""): void {
  forbidContext("extension");

  extensionId = extensionId.trim();
  if (extensionId) {
    localStorage.removeItem(CHROME_EXTENSION_STORAGE_KEY);
  } else {
    localStorage.setItem(CHROME_EXTENSION_STORAGE_KEY, extensionId);
  }
}

export function getChromeExtensionId(): string {
  forbidContext("extension");

  return (
    localStorage.getItem(CHROME_EXTENSION_STORAGE_KEY) ?? CHROME_EXTENSION_ID
  );
}

export function getExtensionVersion(): string {
  return browser.runtime.getManifest().version;
}

export class RuntimeNotFoundError extends Error {
  override name = "RuntimeNotFoundError";
}

export async function readStorage<T = unknown>(
  storageKey: ManualStorageKey,
  defaultValue?: T,
  area: "local" | "managed" | "session" = "local"
): Promise<T | undefined> {
  let result: UnknownObject;

  try {
    // `browser.storage.local` is supposed to have a signature that takes an object that includes default values.
    // On Chrome 93.0.4577.63 that signature appears to return the defaultValue even when the value is set?
    // eslint-disable-next-line security/detect-object-injection -- type-checked
    result = await browser.storage[area].get(storageKey);
  } catch (error) {
    if (area === "managed") {
      // Handle Opera: https://github.com/pixiebrix/pixiebrix-extension/issues/4069
      // We don't officially support Opera, but to keep the error telemetry clean.
      result = {};
    } else {
      throw error;
    }
  }

  if (Object.hasOwn(result, storageKey)) {
    // eslint-disable-next-line security/detect-object-injection -- Just checked with hasOwn
    return result[storageKey] as T;
  }

  return defaultValue;
}

export async function readReduxStorage<T extends JsonValue = JsonValue>(
  storageKey: ReduxStorageKey,
  defaultValue?: T
): Promise<T | undefined> {
  const value = await readStorage(storageKey as unknown as ManualStorageKey);
  if (typeof value === "string") {
    return JSON.parse(value);
  }

  if (value !== undefined) {
    console.warn("Expected JSON-stringified value for key %s", storageKey, {
      value,
    });
  }

  return defaultValue;
}

export async function setStorage(
  storageKey: ManualStorageKey,
  value: unknown,
  area: "local" | "session" = "local"
): Promise<void> {
  await browser.storage[area].set({ [storageKey]: value });
}

export async function setReduxStorage<T extends JsonValue = JsonValue>(
  storageKey: ReduxStorageKey,
  value: T
): Promise<void> {
  await browser.storage.local.set({ [storageKey]: JSON.stringify(value) });
}

export async function onTabClose(watchedTabId: number): Promise<void> {
  await new Promise<void>((resolve) => {
    const listener = (closedTabId: number) => {
      if (closedTabId === watchedTabId) {
        resolve();
        browser.tabs.onRemoved.removeListener(listener);
      }
    };

    browser.tabs.onRemoved.addListener(listener);
  });
}
