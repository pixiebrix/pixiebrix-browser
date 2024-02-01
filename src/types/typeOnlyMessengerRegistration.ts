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

/**
 * @file This file provides Messenger to the strictNullChecks build.
 * It must not be imported.
 * The actual methods must be registered in the appropriate registration.ts file,
 * this is enforced by typescript itself as long as this file is never imported.
 * @see https://github.com/pixiebrix/pixiebrix-extension/issues/6526
 */

/* eslint-disable import/no-restricted-paths -- Type-only file. Remove each import once they end up in the strictNullChecks list */

import {
  type hideSidebar,
  type showSidebar,
  type sidebarWasLoaded,
  type updateSidebar,
  type removeExtensions as removeSidebars,
  type reloadSidebar,
  type getReservedPanelEntries,
} from "@/contentScript/sidebarController";
import { type SerializedError } from "@/types/messengerTypes";
import { type MessageContext } from "@/types/loggerTypes";
import { type JsonObject } from "type-fest";
import { type Event } from "@/telemetry/events";
import { type showMySidePanel } from "@/background/sidePanel";
import { type ensureContentScript } from "@/background/contentScript";
import { type getRecord, type setRecord } from "@/background/dataStore";
import type initPartnerTheme from "@/background/partnerTheme";
import {
  type addTraceEntry,
  type addTraceExit,
  type clearExtensionTraces,
  type clearTraces,
} from "@/telemetry/trace";
import { type captureTab } from "@/background/capture";
import {
  type deleteCachedAuthData,
  type getCachedAuthData,
} from "@/background/auth/authStorage";
import { type setToolbarBadge } from "@/background/toolbarBadge";
import { type handleMenuAction } from "@/contentScript/contextMenus";
import {
  type getFormDefinition,
  type resolveForm,
  type cancelForm,
} from "@/contentScript/ephemeralFormProtocol";
import { type getProcesses, type initRobot } from "@/contentScript/uipath";
import { type checkAvailable } from "@/bricks/available";
import type notify from "@/utils/notify";
import {
  type getPageState,
  type setPageState,
} from "@/contentScript/pageState";
import {
  type cancelTemporaryPanels,
  type getPanelDefinition,
  type resolveTemporaryPanel,
  type stopWaitingForTemporaryPanels,
} from "@/bricks/transformers/temporaryInfo/temporaryPanelProtocol";
import { type closeWalkthroughModal } from "@/contentScript/walkthroughModalProtocol";
import type showWalkthroughModal from "@/components/walkthroughModal/showWalkthroughModal";

declare global {
  interface MessengerMethods {
    // Content script
    FORM_GET_DEFINITION: typeof getFormDefinition;
    FORM_RESOLVE: typeof resolveForm;
    FORM_CANCEL: typeof cancelForm;
    UPDATE_SIDEBAR: typeof updateSidebar;
    SIDEBAR_WAS_LOADED: typeof sidebarWasLoaded;
    SHOW_SIDEBAR: typeof showSidebar;
    HIDE_SIDEBAR: typeof hideSidebar;
    RELOAD_SIDEBAR: typeof reloadSidebar;
    REMOVE_SIDEBARS: typeof removeSidebars;
    HANDLE_MENU_ACTION: typeof handleMenuAction;
    GET_RESERVED_SIDEBAR_ENTRIES: typeof getReservedPanelEntries;
    UIPATH_INIT: typeof initRobot;
    UIPATH_GET_PROCESSES: typeof getProcesses;
    CHECK_AVAILABLE: typeof checkAvailable;
    GET_PAGE_STATE: typeof getPageState;
    SET_PAGE_STATE: typeof setPageState;
    NOTIFY_INFO: typeof notify.info;
    NOTIFY_ERROR: typeof notify.error;
    NOTIFY_SUCCESS: typeof notify.success;
    TEMPORARY_PANEL_CLOSE: typeof stopWaitingForTemporaryPanels;
    TEMPORARY_PANEL_CANCEL: typeof cancelTemporaryPanels;
    TEMPORARY_PANEL_RESOLVE: typeof resolveTemporaryPanel;
    PANEL_GET_DEFINITION: typeof getPanelDefinition;
    WALKTHROUGH_MODAL_CLOSE: typeof closeWalkthroughModal;
    WALKTHROUGH_MODAL_SHOW: typeof showWalkthroughModal;

    // Background
    SHOW_MY_SIDE_PANEL: typeof showMySidePanel;
    INJECT_SCRIPT: typeof ensureContentScript;
    GET_DATA_STORE: typeof getRecord;
    SET_DATA_STORE: typeof setRecord;
    ACTIVATE_PARTNER_THEME: typeof initPartnerTheme;
    ADD_TRACE_ENTRY: typeof addTraceEntry;
    ADD_TRACE_EXIT: typeof addTraceExit;
    CLEAR_TRACES: typeof clearExtensionTraces;
    CLEAR_ALL_TRACES: typeof clearTraces;
    CAPTURE_TAB: typeof captureTab;
    DELETE_CACHED_AUTH: typeof deleteCachedAuthData;
    GET_CACHED_AUTH: typeof getCachedAuthData;
    SET_TOOLBAR_BADGE: typeof setToolbarBadge;

    // Temporary duplicate type for a background method used by the sidebar.
    // NOTE: Changes to those functions must be reflected here.
    RECORD_ERROR: (
      serializedError: SerializedError,
      context: MessageContext,
      data?: JsonObject,
    ) => Promise<void>;

    RECORD_EVENT: (event: {
      event: Event;
      data: JsonObject | undefined;
    }) => Promise<void>;
  }
}
