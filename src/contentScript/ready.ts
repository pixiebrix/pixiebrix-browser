/* eslint-disable @shopify/prefer-module-scope-constants -- Dangerous here, contains copy-pasted code, serialized functions */
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
 * @file Handles the definition and state of "readiness" of the content script (CS) context.
 *
 * There's one "content script" context per extension load. All the content scripts injected
 * by the extension share this context and its symbols, even if injected repeatedly.
 *
 * When the extension is deactivated or reloaded, the content script is still kept active but it's
 * unable to communicate to the background page/worker (because that context has been invalidated).
 * In the console you can see multiple content scripts running at the same time, until you reload the tab.
 *
 * When the (background) context is invalidated, we must manually remove all of its listeners and
 * attached widgets to avoid conflicts with future content script injections:
 * https://github.com/pixiebrix/pixiebrix-extension/issues/4258
 */

import { type Target } from "@/types/messengerTypes";
import { forbidContext } from "@/utils/expectContext";
import { executeFunction } from "webext-content-scripts";

// These two must be synched in `getTargetState`
const CONTENT_SCRIPT_INJECTED_SYMBOL = Symbol.for("content-script-injected");
const CONTENT_SCRIPT_READY_SYMBOL = Symbol.for("content-script-ready");

/** Communicates readiness to `ensureContentScript` */
export const ENSURE_CONTENT_SCRIPT_READY =
  "@@pixiebrix/script/ENSURE_CONTENT_SCRIPT_READY";

declare global {
  interface Window {
    [CONTENT_SCRIPT_INJECTED_SYMBOL]?: true;
    [CONTENT_SCRIPT_READY_SYMBOL]?: true;
  }
}

interface TargetState {
  url: string;
  installed: boolean;
  ready: boolean;
}

/**
 * Returns true iff the content script has been injected in the content script Javascript VM for the window.
 */
export function isContentScriptInstalled(): boolean {
  return CONTENT_SCRIPT_INJECTED_SYMBOL in window;
}

/**
 * Mark that the content script has been injected in content script Javascript VM for the window.
 */
export function setContentScriptInstalled(): void {
  // eslint-disable-next-line security/detect-object-injection -- symbol
  window[CONTENT_SCRIPT_INJECTED_SYMBOL] = true;
}

export function isContentScriptReady(): boolean {
  return CONTENT_SCRIPT_READY_SYMBOL in window;
}

export function setContentScriptReady(): void {
  // eslint-disable-next-line security/detect-object-injection -- symbol
  window[CONTENT_SCRIPT_READY_SYMBOL] = true;
}

/**
 * Fetches the URL and content script state from tab/frame
 * @throws Error if background page doesn't have permission to access the tab
 */
export async function getTargetState(target: Target): Promise<TargetState> {
  forbidContext(
    "web",
    "chrome.tabs is only available in chrome-extension:// pages",
  );

  return executeFunction(target, () => {
    // This function does not have access to globals, the outside scope, nor `import()`
    // These two symbols must be repeated inline
    const CONTENT_SCRIPT_INJECTED_SYMBOL = Symbol.for(
      "content-script-injected",
    );

    const CONTENT_SCRIPT_READY_SYMBOL = Symbol.for("content-script-ready");
    return {
      url: location.href,
      installed: CONTENT_SCRIPT_INJECTED_SYMBOL in globalThis,
      ready: CONTENT_SCRIPT_READY_SYMBOL in globalThis,
    };
  });
}

let reloadOnNextNavigate = false;

/**
 * Return true if the mods should be reloaded on the next navigation.
 */
export function getReloadOnNextNavigate(): boolean {
  return reloadOnNextNavigate;
}

/**
 * Set if the mods should be reloaded on the next navigation.
 */
export function setReloadOnNextNavigate(value: boolean): void {
  reloadOnNextNavigate = value;
}
