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

import { ensureContentScript } from "@/background/contentScript";
import { updateSidebar } from "@/contentScript/messenger/api";
import { browserAction, isMV3, type Tab } from "@/mv3/api";
import { executeScript } from "webext-content-scripts";
import { memoizeUntilSettled } from "@/utils/promiseUtils";
import { openSidePanel } from "@/mv3/sidePanelMigration";
import { setActionPopup } from "webext-tools";
import { getReasonByUrl } from "@/tinyPages/restrictedUrlPopupUtils";

/**
 * Show a popover on restricted URLs because we're unable to inject content into the page. Previously we'd open
 * the Extension Console, but that was confusing because the action was inconsistent with how the button behaves
 * other pages.
 * @param tabUrl the url of the tab, or undefined if not accessible
 */
function getPopoverUrl(tabUrl: string | undefined): string | null {
  const popoverUrl = browser.runtime.getURL("restrictedUrlPopup.html");
  const reason = getReasonByUrl(tabUrl ?? "");

  if (reason) {
    return `${popoverUrl}?reason=${reason}`;
  }

  // The popup is disabled, and the extension will receive browserAction.onClicked events.
  // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/browserAction/setPopup#popup
  return null;
}

export default async function initBrowserAction(): Promise<void> {
  if (!isMV3()) {
    initBrowserActionMv2();
    return;
  }

  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

  // Disable by default, so that it can be enabled on a per-tab basis.
  // Without this, the sidePanel remains open as the user changes tabs
  void chrome.sidePanel.setOptions({
    enabled: false,
  });

  browserAction.onClicked.addListener(async (tab) => {
    await openSidePanel(tab.id);
  });
}

const ERR_UNABLE_TO_OPEN =
  "PixieBrix was unable to open the Sidebar. Try refreshing the page.";

// The sidebar is always injected to into the top level frame
const TOP_LEVEL_FRAME_ID = 0;

const toggleSidebar = memoizeUntilSettled(_toggleSidebar);

// Don't accept objects here as they're not easily memoizable
async function _toggleSidebar(tabId: number, tabUrl: string): Promise<void> {
  console.debug("browserAction:toggleSidebar", tabId, tabUrl);

  // Load the raw toggle script first, then the content script. The browser executes them
  // in order, but we don't need to use `Promise.all` to await them at the same time as we
  // want to catch each error separately.
  const sidebarTogglePromise = executeScript({
    tabId,
    frameId: TOP_LEVEL_FRAME_ID,
    files: ["browserActionInstantHandler.js"],
    matchAboutBlank: false,
    allFrames: false,
    // Run at end instead of idle to ensure immediate feedback to clicking the browser action icon
    runAt: "document_end",
  });

  const contentScriptTarget = {
    tabId,
    frameId: TOP_LEVEL_FRAME_ID,
  } as const;

  // Chrome adds automatically at document_idle, so it might not be ready yet when the user click the browser action
  const contentScriptPromise = ensureContentScript(contentScriptTarget);

  try {
    await sidebarTogglePromise;
  } catch (error) {
    // eslint-disable-next-line no-alert -- Intentional usage, no alternative UI
    alert(ERR_UNABLE_TO_OPEN);
    throw error;
  }

  // NOTE: at this point, the sidebar should already be visible on the page, even if not ready.
  // Avoid showing any alerts or notifications: further messaging can appear in the sidebar itself.
  // Any errors are automatically reported by the global error handler.
  await contentScriptPromise;
  updateSidebar(contentScriptTarget);
}

async function handleBrowserAction(tab: Tab): Promise<void> {
  // The URL might not be available in certain circumstances. This silences these
  // cases and just treats them as "not allowed on this page"
  const url = String(tab.url);
  await toggleSidebar(tab.id, url);
}

function initBrowserActionMv2(): void {
  browserAction.onClicked.addListener(handleBrowserAction);

  // Track the active tab URL. We need to update the popover every time status the active tab/active URL changes.
  // https://github.com/facebook/react/blob/bbb9cb116dbf7b6247721aa0c4bcb6ec249aa8af/packages/react-devtools-extensions/src/background/tabsManager.js#L29
  setActionPopup(getPopoverUrl);
}
