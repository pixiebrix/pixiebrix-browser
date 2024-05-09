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

/* Do not use `registerMethod` in this file */
import { getMethod, getNotifier } from "webext-messenger";

export const showSidebar = getMethod("SHOW_SIDEBAR");
export const hideSidebar = getMethod("HIDE_SIDEBAR");
export const getFormDefinition = getMethod("FORM_GET_DEFINITION");

export const resolveForm = getMethod("FORM_RESOLVE");
export const cancelForm = getNotifier("FORM_CANCEL");

export const handleMenuAction = getMethod("HANDLE_MENU_ACTION");
export const getReservedSidebarEntries = getMethod(
  "GET_RESERVED_SIDEBAR_ENTRIES",
);
export const updateSidebar = getNotifier("UPDATE_SIDEBAR");
export const sidebarWasLoaded = getNotifier("SIDEBAR_WAS_LOADED");
export const removeSidebars = getMethod("REMOVE_SIDEBARS");

export const initRobot = getMethod("UIPATH_INIT");
export const getProcesses = getMethod("UIPATH_GET_PROCESSES");

export const closeWalkthroughModal = getNotifier("WALKTHROUGH_MODAL_CLOSE");
export const showWalkthroughModal = getNotifier("WALKTHROUGH_MODAL_SHOW");

export const getPanelDefinition = getMethod("PANEL_GET_DEFINITION");
export const cancelTemporaryPanel = getNotifier("TEMPORARY_PANEL_CANCEL");
export const closeTemporaryPanel = getNotifier("TEMPORARY_PANEL_CLOSE");
export const resolveTemporaryPanel = getNotifier("TEMPORARY_PANEL_RESOLVE");

export const getPageState = getMethod("GET_PAGE_STATE");
export const setPageState = getMethod("SET_PAGE_STATE");

export const notify = {
  info: getNotifier("NOTIFY_INFO"),
  // TODO: Automatically report from api.ts because of https://github.com/pixiebrix/pixiebrix-extension/blob/dce0d5cbb54d5fc1a61d720e43d17383a152df2e/src/background/contextMenus.ts#L92-L95
  error: getNotifier("NOTIFY_ERROR"),
  success: getNotifier("NOTIFY_SUCCESS"),
};

export const cancelSelect = getMethod("CANCEL_SELECT_ELEMENT");

export const reloadMarketplaceEnhancements = getMethod(
  "RELOAD_MARKETPLACE_ENHANCEMENTS",
);
export const getAttributeExamples = getMethod("GET_ATTRIBUTE_EXAMPLES");
export const selectElement = getMethod("SELECT_ELEMENT");

export const insertPanel = getMethod("INSERT_PANEL");
export const insertButton = getMethod("INSERT_BUTTON");
export const enableOverlay = getMethod("ENABLE_OVERLAY");
export const disableOverlay = getMethod("DISABLE_OVERLAY");
export const runMapArgs = getMethod("RUN_MAP_ARGS");
export const getCopilotHostData = getMethod("GET_COPILOT_HOST_DATA");

export const showLoginBanner = getMethod("SHOW_LOGIN_BANNER");
