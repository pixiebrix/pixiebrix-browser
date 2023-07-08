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

import pTimeout from "p-timeout";
import { type Menus, type Tabs } from "webextension-polyfill";
import chromeP from "webext-polyfill-kinda";
import reportError from "@/telemetry/reportError";
import { handleMenuAction, notify } from "@/contentScript/messenger/api";
import { ensureContentScript } from "@/background/contentScript";
import { expectContext } from "@/utils/expectContext";
import extensionPointRegistry from "@/extensionPoints/registry";
import {
  type ContextMenuConfig,
  ContextMenuExtensionPoint,
} from "@/extensionPoints/contextMenu";
import { loadOptions } from "@/store/extensionsStorage";
import { resolveExtensionInnerDefinitions } from "@/registry/internal";
import { allSettledValues, memoizeUntilSettled } from "@/utils";
import { type UUID } from "@/types/stringTypes";
import {
  type IExtension,
  type ResolvedExtension,
} from "@/types/extensionTypes";

const MENU_PREFIX = "pixiebrix-";

// This constant must be high enough to give Chrome time to inject the content script. ensureContentScript can take
// >= 1 seconds because it also waits for the content script to be ready
const CONTEXT_SCRIPT_INSTALL_MS = 5000;

type SelectionMenuOptions = {
  extensionId: UUID;
  title: string;
  contexts: Menus.ContextType[];
  documentUrlPatterns: string[];
};

function makeMenuId(extensionId: UUID): string {
  return `${MENU_PREFIX}${extensionId}`;
}

/**
 * FIXME: this method doesn't handle frames
 */
async function dispatchMenu(
  info: Menus.OnClickData,
  tab: Tabs.Tab
): Promise<void> {
  expectContext("background");

  const target = { frameId: info.frameId, tabId: tab.id };

  if (typeof info.menuItemId !== "string") {
    throw new TypeError(`Not a PixieBrix menu item: ${info.menuItemId}`);
  }

  console.time("ensureContentScript");

  // Browser will add at document_idle. But ensure it's ready before continuing
  await pTimeout(ensureContentScript(target), {
    milliseconds: CONTEXT_SCRIPT_INSTALL_MS,
    message: `contentScript for context menu handler not ready in ${CONTEXT_SCRIPT_INSTALL_MS}ms`,
  });

  console.timeEnd("ensureContentScript");

  try {
    await handleMenuAction(target, {
      extensionId: info.menuItemId.slice(MENU_PREFIX.length) as UUID,
      args: info,
    });
  } catch (error) {
    // Handle internal/messenger errors here. The real error handling occurs in the contextMenu extension point
    reportError(error);
    notify.error(target, {
      message: "Error handling context menu action",
      reportError: false,
    });
  }
}

function menuListener(info: Menus.OnClickData, tab: Tabs.Tab) {
  if (String(info.menuItemId).startsWith(MENU_PREFIX)) {
    void dispatchMenu(info, tab);
  } else {
    console.debug(`Ignoring menu item: ${info.menuItemId}`);
  }
}

/**
 * Uninstall contextMenu for `extensionId`. Returns true if the contextMenu was removed, or false if the contextMenu was
 * not found.
 */
export async function uninstallContextMenu({
  extensionId,
}: {
  extensionId: UUID;
}): Promise<boolean> {
  try {
    await browser.contextMenus.remove(makeMenuId(extensionId));
    console.debug(`Uninstalled context menu ${extensionId}`);
    return true;
  } catch (error) {
    // Will throw if extensionId doesn't refer to a context menu. The callers don't have an easy way to check the type
    // without having to resolve the extensionPointId. So instead we'll just expect some of the calls to fail.
    console.debug("Could not uninstall context menu %s", extensionId, {
      error,
    });
    return false;
  }
}

export const ensureContextMenu = memoizeUntilSettled(_ensureContextMenu, {
  cacheKey: ([{ extensionId }]) => extensionId,
});
async function _ensureContextMenu({
  extensionId,
  contexts,
  title,
  documentUrlPatterns,
}: SelectionMenuOptions) {
  expectContext("background");

  if (!extensionId) {
    throw new Error("extensionId is required");
  }

  const updateProperties = {
    type: "normal",
    title,
    contexts,
    documentUrlPatterns,
  } satisfies Menus.UpdateUpdatePropertiesType;

  const expectedMenuId = makeMenuId(extensionId);
  try {
    // Try updating it first. It will fail if missing, so we attempt to create it instead
    await browser.contextMenus.update(expectedMenuId, updateProperties);
  } catch {
    // WARNING: Do not remove `chromeP`
    // The standard `contextMenus.create` does not return a Promise in any browser
    // https://github.com/w3c/webextensions/issues/188#issuecomment-1112436359
    // eslint-disable-next-line @typescript-eslint/await-thenable -- The types don't really match `chromeP`
    await chromeP.contextMenus.create({
      ...updateProperties,
      id: expectedMenuId,
    } as chrome.contextMenus.CreateProperties);
  }
}

export async function preloadContextMenus(
  extensions: IExtension[]
): Promise<void> {
  expectContext("background");
  await Promise.allSettled(
    extensions.map(async (definition) => {
      const resolved = await resolveExtensionInnerDefinitions(definition);

      const extensionPoint = await extensionPointRegistry.lookup(
        resolved.extensionPointId
      );
      if (extensionPoint instanceof ContextMenuExtensionPoint) {
        await extensionPoint.ensureMenu(
          definition as unknown as ResolvedExtension<ContextMenuConfig>
        );
      }
    })
  );
}

async function preloadAllContextMenus(): Promise<void> {
  const { extensions } = await loadOptions();
  const resolved = await allSettledValues(
    extensions.map(async (x) => resolveExtensionInnerDefinitions(x))
  );
  await preloadContextMenus(resolved);
}

export default function initContextMenus(): void {
  void preloadAllContextMenus();
  browser.contextMenus.onClicked.addListener(menuListener);
}
