/*
 * Copyright (C) 2022 PixieBrix, Inc.
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

import "./contentScript.scss";

const start = Date.now();
// Importing for the side effects. Should import as early as possible
import "@/extensionContext";
import { uncaughtErrorHandlers } from "@/telemetry/reportUncaughtErrors";
import "@/messaging/external";

// Normal imports
import { uuidv4 } from "@/types/helpers";
import registerMessenger from "@/contentScript/messenger/registration";
import registerBuiltinBlocks from "@/blocks/registerBuiltinBlocks";
import registerContribBlocks from "@/contrib/registerContribBlocks";
import { handleNavigate } from "@/contentScript/lifecycle";
import { markReady, updateTabInfo } from "@/contentScript/context";
import { whoAmI, initTelemetry } from "@/background/messenger/api";
import { ENSURE_CONTENT_SCRIPT_READY } from "@/messaging/constants";
// eslint-disable-next-line import/no-restricted-paths -- Custom devTools mechanism to transfer data
import { addListenerForUpdateSelectedElement } from "@/pageEditor/getSelectedElement";
import { initToaster } from "@/utils/notify";
import { isConnectionError } from "@/errors";
import { showConnectionLost } from "@/contentScript/connection";

const PIXIEBRIX_SYMBOL = Symbol.for("pixiebrix-content-script");
const uuid = uuidv4();

registerMessenger();
registerBuiltinBlocks();
registerContribBlocks();

function ignoreConnectionErrors(
  errorEvent: ErrorEvent | PromiseRejectionEvent
): void {
  if (isConnectionError(errorEvent)) {
    showConnectionLost();
    errorEvent.preventDefault();
  }
}

// Must come before the default handler for ignoring errors. Otherwise, this handler might not be run
uncaughtErrorHandlers.unshift(ignoreConnectionErrors);

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

  // Inform the external website
  markReady();

  // Inform `ensureContentScript`
  void browser.runtime.sendMessage({ type: ENSURE_CONTENT_SCRIPT_READY });

  console.info(`contentScript ready in ${Date.now() - start}ms`);
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
