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

/* Do not use `getMethod` in this file; Keep only registrations here, not implementations */
import { registerMethods } from "webext-messenger";
import { expectContext } from "@/utils/expectContext";
import * as sheets from "@/contrib/google/sheets/core/sheetsApi";
import {
  ensureContextMenu,
  preloadContextMenus,
  uninstallContextMenu,
} from "@/background/contextMenus";
import {
  activateTab,
  closeTab,
  openTab,
  requestRunInAllFrames,
  requestRunInOtherTabs,
  requestRunInOpener,
  requestRunInTarget,
  requestRunInTop,
} from "@/background/executor";
import * as registry from "@/registry/packageRegistry";
import serviceRegistry from "@/integrations/registry";
import { performConfiguredRequest } from "@/background/requests";
import { getAvailableVersion } from "@/background/installer";
import { locator, refreshServices } from "@/background/locator";
import { reactivateEveryTab } from "@/background/navigation";
import { removeExtensionForEveryTab } from "@/background/removeExtensionForEveryTab";
import { debouncedInstallStarterMods as installStarterBlueprints } from "@/background/starterMods";
import {
  clearExtensionDebugLogs,
  clearLog,
  clearLogs,
  recordError,
  recordLog,
} from "@/telemetry/logging";
import {
  collectPerformanceDiagnostics,
  initTelemetry,
  pong,
  recordEvent,
  sendDeploymentAlert,
  uid,
} from "@/background/telemetry";
import { getUserData } from "@/auth/token";
import {
  getPartnerPrincipals,
  launchAuthIntegration,
} from "@/background/partnerIntegrations";
import { setCopilotProcessData } from "@/background/partnerHandlers";

expectContext("background");

declare global {
  interface MessengerMethods {
    GOOGLE_DRIVE_IS_LOGGED_IN: typeof sheets.isLoggedIn;
    GOOGLE_DRIVE_GET_USER_EMAIL: typeof sheets.getGoogleUserEmail;

    GOOGLE_SHEETS_GET_ALL_SPREADSHEETS: typeof sheets.getAllSpreadsheets;
    GOOGLE_SHEETS_GET_SPREADSHEET: typeof sheets.getSpreadsheet;
    GOOGLE_SHEETS_GET_HEADERS: typeof sheets.getHeaders;
    GOOGLE_SHEETS_GET_ALL_ROWS: typeof sheets.getAllRows;
    GOOGLE_SHEETS_CREATE_TAB: typeof sheets.createTab;
    GOOGLE_SHEETS_APPEND_ROWS: typeof sheets.appendRows;

    GET_AVAILABLE_VERSION: typeof getAvailableVersion;
    PRELOAD_CONTEXT_MENUS: typeof preloadContextMenus;
    UNINSTALL_CONTEXT_MENU: typeof uninstallContextMenu;
    ENSURE_CONTEXT_MENU: typeof ensureContextMenu;

    GET_PARTNER_PRINCIPALS: typeof getPartnerPrincipals;
    LAUNCH_AUTH_INTEGRATION: typeof launchAuthIntegration;
    SET_PARTNER_COPILOT_DATA: typeof setCopilotProcessData;

    INSTALL_STARTER_BLUEPRINTS: typeof installStarterBlueprints;

    GET_UID: typeof uid;

    PING: typeof pong;
    COLLECT_PERFORMANCE_DIAGNOSTICS: typeof collectPerformanceDiagnostics;

    ACTIVATE_TAB: typeof activateTab;
    REACTIVATE_EVERY_TAB: typeof reactivateEveryTab;
    REMOVE_EXTENSION_EVERY_TAB: typeof removeExtensionForEveryTab;
    CLOSE_TAB: typeof closeTab;
    OPEN_TAB: typeof openTab;
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
    REQUEST_RUN_IN_OTHER_TABS: typeof requestRunInOtherTabs;
    REQUEST_RUN_IN_ALL_FRAMES: typeof requestRunInAllFrames;

    CONFIGURED_REQUEST: typeof performConfiguredRequest;
    CLEAR_SERVICE_CACHE: VoidFunction;
    RECORD_LOG: typeof recordLog;
    RECORD_ERROR: typeof recordError;
    RECORD_EVENT: typeof recordEvent;
    CLEAR_LOGS: typeof clearLogs;
    CLEAR_LOG: typeof clearLog;
    CLEAR_EXTENSION_DEBUG_LOGS: typeof clearExtensionDebugLogs;

    INIT_TELEMETRY: typeof initTelemetry;
    SEND_DEPLOYMENT_ALERT: typeof sendDeploymentAlert;

    GET_USER_DATA: typeof getUserData;
  }
}

export default function registerMessenger(): void {
  registerMethods({
    GOOGLE_DRIVE_IS_LOGGED_IN: sheets.isLoggedIn,
    GOOGLE_DRIVE_GET_USER_EMAIL: sheets.getGoogleUserEmail,

    GOOGLE_SHEETS_GET_ALL_SPREADSHEETS: sheets.getAllSpreadsheets,
    GOOGLE_SHEETS_GET_SPREADSHEET: sheets.getSpreadsheet,
    GOOGLE_SHEETS_GET_HEADERS: sheets.getHeaders,
    GOOGLE_SHEETS_GET_ALL_ROWS: sheets.getAllRows,
    GOOGLE_SHEETS_CREATE_TAB: sheets.createTab,
    GOOGLE_SHEETS_APPEND_ROWS: sheets.appendRows,

    GET_PARTNER_PRINCIPALS: getPartnerPrincipals,
    LAUNCH_AUTH_INTEGRATION: launchAuthIntegration,
    SET_PARTNER_COPILOT_DATA: setCopilotProcessData,

    INSTALL_STARTER_BLUEPRINTS: installStarterBlueprints,

    GET_AVAILABLE_VERSION: getAvailableVersion,

    PRELOAD_CONTEXT_MENUS: preloadContextMenus,
    UNINSTALL_CONTEXT_MENU: uninstallContextMenu,
    ENSURE_CONTEXT_MENU: ensureContextMenu,

    GET_UID: uid,

    PING: pong,
    COLLECT_PERFORMANCE_DIAGNOSTICS: collectPerformanceDiagnostics,

    ACTIVATE_TAB: activateTab,
    REACTIVATE_EVERY_TAB: reactivateEveryTab,
    REMOVE_EXTENSION_EVERY_TAB: removeExtensionForEveryTab,
    CLOSE_TAB: closeTab,
    OPEN_TAB: openTab,
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
    REQUEST_RUN_IN_OTHER_TABS: requestRunInOtherTabs,
    REQUEST_RUN_IN_ALL_FRAMES: requestRunInAllFrames,

    CLEAR_SERVICE_CACHE: serviceRegistry.clear.bind(serviceRegistry),
    CONFIGURED_REQUEST: performConfiguredRequest,

    RECORD_LOG: recordLog,
    RECORD_ERROR: recordError,
    RECORD_EVENT: recordEvent,
    CLEAR_LOGS: clearLogs,
    CLEAR_LOG: clearLog,
    CLEAR_EXTENSION_DEBUG_LOGS: clearExtensionDebugLogs,

    INIT_TELEMETRY: initTelemetry,
    SEND_DEPLOYMENT_ALERT: sendDeploymentAlert,

    GET_USER_DATA: getUserData,
  });
}
