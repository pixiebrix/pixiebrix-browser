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
 * @file This file defines the public API for the sidePanel, with some
 * exceptions that use `expectContext`. It uses the `messenger/api.ts` name
 * to match that expectation and avoid lint issues.
 */

import { expectContext } from "@/utils/expectContext";
import { messenger } from "webext-messenger";
import { getErrorMessage } from "@/errors/errorHelpers";
import { getSidebarInThisTab } from "@/sidebar/messenger/api";

export async function isSidePanelOpen(): Promise<boolean> {
  expectContext(
    "contentScript",
    "isSidePanelOpen only works from the same content script for now",
  );

  // Sync check where possible, which is the content script
  if (isSidePanelOpenSync() === false) {
    return false;
  }

  try {
    // If ever needed, `isSidePanelOpen` could be called from any context, as long as
    // `getSidebarInThisTab` is replaced/complemented by a tabid-specific `{page: "/sidebar.html?tabId=123"}` target
    await messenger(
      "SIDEBAR_PING",
      { retry: false },
      await getSidebarInThisTab(),
    );
    return true;
  } catch {
    return false;
  }
}

/** @deprecated Use this instead: import { openSidePanel } from "@/mv3/sidePanelMigration"; */
export async function _openSidePanel(tabId: number): Promise<void> {
  // Simultaneously enable and open the side panel.
  // If we wait too long before calling .open(), we will lose the "user gesture" permission
  // There is no way to know whether the side panel is open yet, so we call it regardless.
  void chrome.sidePanel.setOptions({
    tabId,
    enabled: true,
  });

  try {
    // TODO: Implement toggle, but I don't think it's possible:
    // https://github.com/pixiebrix/pixiebrix-extension/issues/7327
    await chrome.sidePanel.open({ tabId });
  } catch (error) {
    // In some cases, `openSidePanel` is called as a precaution and it might work if
    // it's still part of a user gesture.
    // If it's not, it will throw an error *even if the side panel is already open*.
    // The following code silences that error iff the side panel is already open.
    if (
      getErrorMessage(error).includes("user gesture") &&
      (await isSidePanelOpen())
    ) {
      // The `openSidePanel` call was not required in the first place, the error can be silenced
      // TODO: After switching to MV3, verify whether we drop that `openSidePanel` call
      return;
    }

    throw error;
  }
}

/* Approximate sidebar width in pixels. Used to determine whether it's open */
const MINIMUM_SIDEBAR_WIDTH = 300;

/**
 * Determines whether the sidebar is open.
 * @returns false when it's definitely closed
 * @returns 'unknown' when it cannot be determined
 */
// The type cannot be `undefined` due to strictNullChecks
export function isSidePanelOpenSync(): false | "unknown" {
  if (!globalThis.window) {
    return "unknown";
  }

  return window.outerWidth - window.innerWidth > MINIMUM_SIDEBAR_WIDTH
    ? "unknown"
    : false;
}
