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

/* Do not use `getMethod` in this file; Keep only registrations here, not implementations */
import { registerMethods } from "webext-messenger";
import { expectContext } from "@/utils/expectContext";
import * as sheets from "@/contrib/google/sheets/handlers";
import {
  ensureContextMenu,
  uninstallContextMenu,
  preloadContextMenus,
} from "@/background/contextMenus";
import { openPopupPrompt } from "@/background/permissionPrompt";
import {
  activateTab,
  closeTab,
  openTab,
  requestRunInOpener,
  requestRunInTarget,
  requestRunInBroadcast,
  waitForTargetByUrl,
  requestRunInTop,
} from "@/background/executor";
import * as registry from "@/registry/localRegistry";
import { ensureContentScript } from "@/background/contentScript";
import serviceRegistry from "@/services/registry";
import { deleteCachedAuthData, getCachedAuthData } from "@/background/auth";
import { proxyService } from "@/background/requests";
import { readQuery } from "@/contrib/google/bigquery/handlers";
import { getRecord, setRecord } from "@/background/dataStore";
import { getAvailableVersion } from "@/background/installer";
import { locator, refreshServices } from "@/background/locator";
import {
  reactivateEveryTab,
  removeExtensionForEveryTab,
} from "@/background/navigation";
import initPartnerTheme from "@/background/partnerTheme";

import {
  clearExtensionDebugLogs,
  clearLog,
  clearLogs,
  recordError,
  recordLog,
  recordWarning,
} from "@/telemetry/logging";
import {
  addTraceEntry,
  addTraceExit,
  clearExtensionTraces,
  clearTraces,
} from "@/telemetry/trace";
import {
  initTelemetry,
  recordEvent,
  sendDeploymentAlert,
  uid,
} from "@/background/telemetry";
import { captureTab } from "@/background/capture";
import { getUserData } from "@/auth/token";
import {
  getPartnerPrincipals,
  launchAuthIntegration,
} from "@/background/partnerIntegrations";

expectContext("background");

declare global {
  interface MessengerMethods {
    GOOGLE_SHEETS_GET_TAB_NAMES: typeof sheets.getTabNames;
    GOOGLE_SHEETS_GET_SHEET_PROPERTIES: typeof sheets.getSheetProperties;
    GOOGLE_SHEETS_GET_HEADERS: typeof sheets.getHeaders;
    GOOGLE_SHEETS_CREATE_TAB: typeof sheets.createTab;
    GOOGLE_SHEETS_APPEND_ROWS: typeof sheets.appendRows;
    GOOGLE_SHEETS_BATCH_UPDATE: typeof sheets.batchUpdate;
    GOOGLE_SHEETS_BATCH_GET: typeof sheets.batchGet;

    GET_AVAILABLE_VERSION: typeof getAvailableVersion;
    INJECT_SCRIPT: typeof ensureContentScript;
    CONTAINS_PERMISSIONS: typeof browser.permissions.contains;
    PRELOAD_CONTEXT_MENUS: typeof preloadContextMenus;
    UNINSTALL_CONTEXT_MENU: typeof uninstallContextMenu;
    ENSURE_CONTEXT_MENU: typeof ensureContextMenu;
    OPEN_POPUP_PROMPT: typeof openPopupPrompt;

    ACTIVATE_PARTNER_THEME: typeof initPartnerTheme;
    GET_PARTNER_PRINCIPALS: typeof getPartnerPrincipals;
    LAUNCH_AUTH_INTEGRATION: typeof launchAuthIntegration;

    GET_UID: typeof uid;
    WAIT_FOR_TARGET_BY_URL: typeof waitForTargetByUrl;

    ACTIVATE_TAB: typeof activateTab;
    REACTIVATE_EVERY_TAB: typeof reactivateEveryTab;
    REMOVE_EXTENSION_EVERY_TAB: typeof removeExtensionForEveryTab;
    CLOSE_TAB: typeof closeTab;
    OPEN_TAB: typeof openTab;
    REGISTRY_FETCH: typeof registry.fetchNewPackages;
    REGISTRY_SYNC: typeof registry.syncPackages;
    REGISTRY_CLEAR: typeof registry.clear;
    REGISTRY_GET_BY_KINDS: typeof registry.getByKinds;
    REGISTRY_FIND: typeof registry.find;
    LOCATE_SERVICES_FOR_ID: typeof locator.locateAllForService;
    LOCATE_SERVICE: typeof locator.locate;
    REFRESH_SERVICES: typeof refreshServices;
    LOCATOR_REFRESH_LOCAL: typeof locator.refreshLocal;

    REQUEST_RUN_IN_OPENER: typeof requestRunInOpener;
    REQUEST_RUN_IN_TARGET: typeof requestRunInTarget;
    REQUEST_RUN_IN_TOP: typeof requestRunInTop;
    REQUEST_RUN_IN_ALL: typeof requestRunInBroadcast;

    DELETE_CACHED_AUTH: typeof deleteCachedAuthData;
    GET_CACHED_AUTH: typeof getCachedAuthData;
    PROXY: typeof proxyService;
    CLEAR_SERVICE_CACHE: VoidFunction;
    GOOGLE_BIGQUERY_READ: typeof readQuery;

    GET_DATA_STORE: typeof getRecord;
    SET_DATA_STORE: typeof setRecord;

    RECORD_LOG: typeof recordLog;
    RECORD_WARNING: typeof recordWarning;
    RECORD_ERROR: typeof recordError;
    RECORD_EVENT: typeof recordEvent;
    CLEAR_LOGS: typeof clearLogs;
    CLEAR_LOG: typeof clearLog;
    CLEAR_EXTENSION_DEBUG_LOGS: typeof clearExtensionDebugLogs;

    ADD_TRACE_ENTRY: typeof addTraceEntry;
    ADD_TRACE_EXIT: typeof addTraceExit;
    CLEAR_TRACES: typeof clearExtensionTraces;
    CLEAR_ALL_TRACES: typeof clearTraces;

    INIT_TELEMETRY: typeof initTelemetry;
    SEND_DEPLOYMENT_ALERT: typeof sendDeploymentAlert;

    CAPTURE_TAB: typeof captureTab;

    GET_USER_DATA: typeof getUserData;
  }
}

export default function registerMessenger(): void {
  registerMethods({
    GOOGLE_SHEETS_GET_TAB_NAMES: sheets.getTabNames,
    GOOGLE_SHEETS_GET_SHEET_PROPERTIES: sheets.getSheetProperties,
    GOOGLE_SHEETS_GET_HEADERS: sheets.getHeaders,
    GOOGLE_SHEETS_CREATE_TAB: sheets.createTab,
    GOOGLE_SHEETS_APPEND_ROWS: sheets.appendRows,
    GOOGLE_SHEETS_BATCH_UPDATE: sheets.batchUpdate,
    GOOGLE_SHEETS_BATCH_GET: sheets.batchGet,

    ACTIVATE_PARTNER_THEME: initPartnerTheme,
    GET_PARTNER_PRINCIPALS: getPartnerPrincipals,
    LAUNCH_AUTH_INTEGRATION: launchAuthIntegration,

    GET_AVAILABLE_VERSION: getAvailableVersion,
    INJECT_SCRIPT: ensureContentScript,
    CONTAINS_PERMISSIONS: browser.permissions.contains,

    PRELOAD_CONTEXT_MENUS: preloadContextMenus,
    UNINSTALL_CONTEXT_MENU: uninstallContextMenu,
    ENSURE_CONTEXT_MENU: ensureContextMenu,
    OPEN_POPUP_PROMPT: openPopupPrompt,

    GET_UID: uid,
    WAIT_FOR_TARGET_BY_URL: waitForTargetByUrl,

    ACTIVATE_TAB: activateTab,
    REACTIVATE_EVERY_TAB: reactivateEveryTab,
    REMOVE_EXTENSION_EVERY_TAB: removeExtensionForEveryTab,
    CLOSE_TAB: closeTab,
    OPEN_TAB: openTab,
    REGISTRY_FETCH: registry.fetchNewPackages,
    REGISTRY_SYNC: registry.syncPackages,
    REGISTRY_CLEAR: registry.clear,
    REGISTRY_GET_BY_KINDS: registry.getByKinds,
    REGISTRY_FIND: registry.find,
    LOCATE_SERVICES_FOR_ID: locator.locateAllForService.bind(locator),
    LOCATE_SERVICE: locator.locate.bind(locator),
    LOCATOR_REFRESH_LOCAL: locator.refreshLocal.bind(locator),
    REFRESH_SERVICES: refreshServices,

    REQUEST_RUN_IN_OPENER: requestRunInOpener,
    REQUEST_RUN_IN_TARGET: requestRunInTarget,
    REQUEST_RUN_IN_TOP: requestRunInTop,
    REQUEST_RUN_IN_ALL: requestRunInBroadcast,

    DELETE_CACHED_AUTH: deleteCachedAuthData,
    GET_CACHED_AUTH: getCachedAuthData,
    CLEAR_SERVICE_CACHE: serviceRegistry.clear.bind(serviceRegistry),
    PROXY: proxyService,
    GOOGLE_BIGQUERY_READ: readQuery,

    GET_DATA_STORE: getRecord,
    SET_DATA_STORE: setRecord,

    RECORD_LOG: recordLog,
    RECORD_WARNING: recordWarning,
    RECORD_ERROR: recordError,
    RECORD_EVENT: recordEvent,
    CLEAR_LOGS: clearLogs,
    CLEAR_LOG: clearLog,
    CLEAR_EXTENSION_DEBUG_LOGS: clearExtensionDebugLogs,

    ADD_TRACE_ENTRY: addTraceEntry,
    ADD_TRACE_EXIT: addTraceExit,
    CLEAR_TRACES: clearExtensionTraces,
    CLEAR_ALL_TRACES: clearTraces,

    INIT_TELEMETRY: initTelemetry,
    SEND_DEPLOYMENT_ALERT: sendDeploymentAlert,

    CAPTURE_TAB: captureTab,

    GET_USER_DATA: getUserData,
  });
}
