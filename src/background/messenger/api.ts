/*
 * Copyright (C) 2021 PixieBrix, Inc.
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

/* Do not use `registerMethod` in this file */
import {
  backgroundTarget as bg,
  getMethod,
  getNotifier,
} from "webext-messenger";
import browser from "webextension-polyfill";
import { isBackgroundPage } from "webext-detect-page";

// TODO: This should be a hard error, but due to unknown dependency routes, it can't be enforced yet
if (isBackgroundPage() && process.env.DEBUG) {
  console.warn(
    "This should not have been imported in the background page. Use the API directly instead."
  );
}

// Chrome offers this API in more contexts than Firefox, so it skips the messenger entirely
export const containsPermissions = browser.permissions
  ? browser.permissions.contains
  : getMethod("CONTAINS_PERMISSIONS", bg);

export const getAvailableVersion = getMethod("GET_AVAILABLE_VERSION", bg);
export const ensureContentScript = getMethod("INJECT_SCRIPT", bg);
export const checkTargetPermissions = getMethod("CHECK_TARGET_PERMISSIONS", bg);
export const openPopupPrompt = getMethod("OPEN_POPUP_PROMPT", bg);
export const whoAmI = getMethod("ECHO_SENDER", bg);

export const activateTab = getMethod("ACTIVATE_TAB", bg);
export const reactivateEveryTab = getNotifier("REACTIVATE_EVERY_TAB", bg);

export const closeTab = getMethod("CLOSE_TAB", bg);
export const markTabAsReady = getMethod("MARK_TAB_AS_READY", bg);
export const deleteCachedAuthData = getMethod("DELETE_CACHED_AUTH", bg);
export const clearServiceCache = getMethod("CLEAR_SERVICE_CACHE", bg);
export const readGoogleBigQuery = getMethod("GOOGLE_BIGQUERY_READ", bg);

export const sheets = {
  getTabNames: getMethod("GOOGLE_SHEETS_GET_TAB_NAMES", bg),
  getSheetProperties: getMethod("GOOGLE_SHEETS_GET_SHEET_PROPERTIES", bg),
  getHeaders: getMethod("GOOGLE_SHEETS_GET_HEADERS", bg),
  createTab: getMethod("GOOGLE_SHEETS_CREATE_TAB", bg),
  appendRows: getMethod("GOOGLE_SHEETS_APPEND_ROWS", bg),
  batchUpdate: getMethod("GOOGLE_SHEETS_BATCH_UPDATE", bg),
  batchGet: getMethod("GOOGLE_SHEETS_BATCH_GET", bg),
};

/**
 * Uninstall context menu and return whether or not the context menu was uninstalled.
 */
export const uninstallContextMenu = getMethod("UNINSTALL_CONTEXT_MENU", bg);
export const ensureContextMenu = getMethod("ENSURE_CONTEXT_MENU", bg);
export const openTab = getMethod("OPEN_TAB", bg);

export const registry = {
  getKind: getMethod("REGISTRY_GET_KIND", bg),
  syncRemote: getMethod("REGISTRY_SYNC", bg),
  find: getMethod("REGISTRY_FIND", bg),
};

export const dataStore = {
  get: getMethod("GET_DATA_STORE", bg),
  set: getMethod("SET_DATA_STORE", bg),
};

export const requestRun = {
  onServer: getMethod("REQUEST_RUN_ON_SERVER", bg),
  inOpener: getMethod("REQUEST_RUN_IN_OPENER", bg),
  inTarget: getMethod("REQUEST_RUN_IN_TARGET", bg),
  inFrame: getMethod("REQUEST_RUN_IN_FRAME_NONCE", bg),
  inAll: getMethod("REQUEST_RUN_IN_ALL", bg),
};

export const contextMenus = {
  preload: getMethod("PRELOAD_CONTEXT_MENUS", bg),
};

export const services = {
  locate: getMethod("LOCATE_SERVICE", bg),
  refresh: getMethod("REFRESH_SERVICES", bg),
};
