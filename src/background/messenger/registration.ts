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

/**
 * @file
 * Do not use `getMethod` in this file; Keep only registrations here, not implementations
 *
 * `strictNullCheck errors` context: https://github.com/pixiebrix/pixiebrix-extension/issues/6526
 */

import { registerMethods } from "webext-messenger";
import { expectContext } from "@/utils/expectContext";
import {
  ensureContextMenu,
  preloadContextMenus,
  uninstallContextMenu,
} from "@/background/contextMenus"; // 218 strictNullCheck errors
import {
  requestRunInAllFrames,
  requestRunInOtherTabs,
  requestRunInOpener,
  requestRunInTarget,
  requestRunInTop,
} from "@/background/executor"; // Depends on contentScript/messenger to pass strictNullCheck
import { performConfiguredRequest } from "@/background/requests"; // 7 strictNullCheck errors
import { getAvailableVersion } from "@/background/installer"; // 201 strictNullCheck errors
import { removeExtensionForEveryTab } from "@/background/removeExtensionForEveryTab"; // 218 strictNullCheck errors
import { debouncedActivateStarterMods as installStarterBlueprints } from "@/background/starterMods"; // 224 strictNullCheck errors
import {
  collectPerformanceDiagnostics,
  initTelemetry,
  pong,
  recordEvent,
  sendDeploymentAlert,
} from "@/background/telemetry"; // 197 strictNullCheck errors
import {
  getPartnerPrincipals,
  launchAuthIntegration,
} from "@/background/partnerIntegrations"; // 24 strictNullCheck errors
import { setCopilotProcessData } from "@/background/partnerHandlers"; // 29 strictNullCheck errors

expectContext("background");

declare global {
  interface MessengerMethods {
    GET_AVAILABLE_VERSION: typeof getAvailableVersion;
    PRELOAD_CONTEXT_MENUS: typeof preloadContextMenus;
    UNINSTALL_CONTEXT_MENU: typeof uninstallContextMenu;
    ENSURE_CONTEXT_MENU: typeof ensureContextMenu;

    GET_PARTNER_PRINCIPALS: typeof getPartnerPrincipals;
    LAUNCH_AUTH_INTEGRATION: typeof launchAuthIntegration;
    SET_PARTNER_COPILOT_DATA: typeof setCopilotProcessData;

    INSTALL_STARTER_BLUEPRINTS: typeof installStarterBlueprints;

    PING: typeof pong;
    COLLECT_PERFORMANCE_DIAGNOSTICS: typeof collectPerformanceDiagnostics;

    REMOVE_EXTENSION_EVERY_TAB: typeof removeExtensionForEveryTab;

    REQUEST_RUN_IN_OPENER: typeof requestRunInOpener;
    REQUEST_RUN_IN_TARGET: typeof requestRunInTarget;
    REQUEST_RUN_IN_TOP: typeof requestRunInTop;
    REQUEST_RUN_IN_OTHER_TABS: typeof requestRunInOtherTabs;
    REQUEST_RUN_IN_ALL_FRAMES: typeof requestRunInAllFrames;

    CONFIGURED_REQUEST: typeof performConfiguredRequest;
    RECORD_EVENT: typeof recordEvent;
    INIT_TELEMETRY: typeof initTelemetry;
    SEND_DEPLOYMENT_ALERT: typeof sendDeploymentAlert;
  }
}

export default function registerMessenger(): void {
  registerMethods({
    GET_PARTNER_PRINCIPALS: getPartnerPrincipals,
    LAUNCH_AUTH_INTEGRATION: launchAuthIntegration,
    SET_PARTNER_COPILOT_DATA: setCopilotProcessData,

    INSTALL_STARTER_BLUEPRINTS: installStarterBlueprints,

    GET_AVAILABLE_VERSION: getAvailableVersion,

    PRELOAD_CONTEXT_MENUS: preloadContextMenus,
    UNINSTALL_CONTEXT_MENU: uninstallContextMenu,
    ENSURE_CONTEXT_MENU: ensureContextMenu,

    PING: pong,
    COLLECT_PERFORMANCE_DIAGNOSTICS: collectPerformanceDiagnostics,

    REMOVE_EXTENSION_EVERY_TAB: removeExtensionForEveryTab,

    REQUEST_RUN_IN_OPENER: requestRunInOpener,
    REQUEST_RUN_IN_TARGET: requestRunInTarget,
    REQUEST_RUN_IN_TOP: requestRunInTop,
    REQUEST_RUN_IN_OTHER_TABS: requestRunInOtherTabs,
    REQUEST_RUN_IN_ALL_FRAMES: requestRunInAllFrames,

    CONFIGURED_REQUEST: performConfiguredRequest,
    RECORD_EVENT: recordEvent,
    INIT_TELEMETRY: initTelemetry,
    SEND_DEPLOYMENT_ALERT: sendDeploymentAlert,
  });
}
