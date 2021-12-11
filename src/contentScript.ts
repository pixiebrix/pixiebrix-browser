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

import { uuidv4 } from "@/types/helpers";

const start = Date.now();

import "@/extensionContext";
import { uncaughtErrorHandlers } from "@/telemetry/reportUncaughtErrors";
import "@/contentScript/messenger/registration";
import browser from "webextension-polyfill";
import registerBuiltinBlocks from "@/blocks/registerBuiltinBlocks";
import registerContribBlocks from "@/contrib/registerContribBlocks";
import { handleNavigate } from "@/contentScript/lifecycle";
import "@/messaging/external";
import { markReady, updateTabInfo } from "@/contentScript/context";
import { initTelemetry } from "@/telemetry/events";
import { markTabAsReady, whoAmI } from "@/background/messenger/api";
import { showConnectionLost } from "@/contentScript/connection";
import { isConnectionError } from "@/errors";
import { ENSURE_CONTENT_SCRIPT_READY } from "@/messaging/constants";
import { addListenerForUpdateSelectedElement } from "@/devTools/getSelectedElement";
import { initToaster } from "@/contentScript/notify";

const PIXIEBRIX_SYMBOL = Symbol.for("pixiebrix-content-script");
const uuid = uuidv4();

function ignoreConnectionErrors(
  errorEvent: ErrorEvent | PromiseRejectionEvent
): void {
  if (isConnectionError(errorEvent)) {
    showConnectionLost();
    errorEvent.preventDefault();
  }
}

// Must run as early as possible
uncaughtErrorHandlers.add(ignoreConnectionErrors);

registerBuiltinBlocks();
registerContribBlocks();

declare global {
  interface Window {
    [PIXIEBRIX_SYMBOL]?: string;
  }
}

async function init(): Promise<void> {
  addListenerForUpdateSelectedElement();
  initTelemetry();
  initToaster();

  const sender = await whoAmI();

  updateTabInfo({ tabId: sender.tab.id, frameId: sender.frameId });
  console.debug(
    `Loading contentScript for tabId=${sender.tab.id}, frameId=${sender.frameId}: ${uuid}`
  );

  try {
    await handleNavigate();
  } catch (error) {
    console.error("Error initializing contentScript", error);
    throw error;
  }

  try {
    // Notify the background script know we're ready to execute remote actions
    markReady();

    // Inform `ensureContentScript` that the content script has loaded, if it's listening
    void browser.runtime.sendMessage({ type: ENSURE_CONTENT_SCRIPT_READY });

    // Informs the standard background listener to track this tab
    await markTabAsReady();
    console.info(`contentScript ready in ${Date.now() - start}ms`);
  } catch (error) {
    console.error("Error pinging the background script", error);
    throw error;
  }
}

// Make sure we don't install the content script multiple times
// eslint-disable-next-line security/detect-object-injection -- using PIXIEBRIX_SYMBOL
const existing: string = window[PIXIEBRIX_SYMBOL];
if (existing) {
  console.debug(`PixieBrix contentScript already installed: ${existing}`);
} else {
  // eslint-disable-next-line security/detect-object-injection -- using PIXIEBRIX_SYMBOL
  window[PIXIEBRIX_SYMBOL] = uuid;
  void init();
}
