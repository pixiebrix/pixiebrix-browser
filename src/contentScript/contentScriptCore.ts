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

import "./contentScript.scss";

import "@/extensionContext";

// Normal imports
import { initMessengerLogging } from "@/development/messengerLogging";
import registerExternalMessenger from "@/background/messenger/external/registration";
import registerMessenger from "@/contentScript/messenger/registration";
import registerMessengerStrict from "@/contentScript/messenger/strict/registration";
import registerBuiltinBricks from "@/bricks/registerBuiltinBricks";
import registerContribBlocks from "@/contrib/registerContribBlocks";
import brickRegistry from "@/bricks/registry";
import { initNavigation } from "@/contentScript/lifecycle";
import { initTelemetry } from "@/background/messenger/api";
import { ENSURE_CONTENT_SCRIPT_READY } from "@/contentScript/ready";
import { initToaster } from "@/utils/notify";
import { initPartnerIntegrations } from "@/contentScript/partnerIntegrations";
import {
  isContextInvalidatedError,
  notifyContextInvalidated,
} from "@/errors/contextInvalidated";
import { onUncaughtError } from "@/errors/errorHelpers";
import initFloatingActions from "@/components/floatingActions/initFloatingActions";
import { initSidebarActivation } from "@/contentScript/sidebarActivation";
import { initPerformanceMonitoring } from "@/contentScript/performanceMonitoring";
import { initRuntime } from "@/runtime/reducePipeline";
import { renderPanelsIfVisible } from "./sidebarController";
import {
  isSidebarFrameVisible,
  removeSidebarFrame,
} from "./sidebarDomControllerLite";
import { isMV3 } from "@/mv3/api";
import { onContextInvalidated } from "webext-events";

// Must come before the default handler for ignoring errors. Otherwise, this handler might not be run
onUncaughtError((error) => {
  // Rather than a global `onContextInvalidated` listener, we want to notify the user only when
  // they're actually interacting with PixieBrix, otherwise they might receive the notification
  // at random times.
  if (isContextInvalidatedError(error)) {
    void notifyContextInvalidated();
  }
});

export async function init(): Promise<void> {
  console.debug(`contentScriptCore: init, location: ${location.href}`);

  void initMessengerLogging();
  registerMessenger();
  registerMessengerStrict();
  registerExternalMessenger();
  registerBuiltinBricks();
  registerContribBlocks();
  // Since 1.8.2, the brick registry was de-coupled from the runtime to avoid circular dependencies
  initRuntime(brickRegistry);

  initTelemetry();
  initToaster();

  void initNavigation();

  void initSidebarActivation();

  // Notify `ensureContentScript`
  void browser.runtime.sendMessage({ type: ENSURE_CONTENT_SCRIPT_READY });

  // Update `sidePanel`
  // TODO: VERIFY: This replaces the old "sidebarController:showSidebar emitting sidebarShowEvents" in `showSidebar` right?
  void renderPanelsIfVisible();

  // Let the partner page know
  initPartnerIntegrations();
  void initFloatingActions();

  void initPerformanceMonitoring();

  onContextInvalidated.addListener(() => {
    // The sidebar breaks when the context is invalidated, so it's best to close it
    // In MV3, this happens automatically
    if (!isMV3() && isSidebarFrameVisible()) {
      removeSidebarFrame();
      // TODO: Also notify closure in MV3.
      // There it's more complicated to show this message ONLY if the sidebar was open
      // because the sidebar is closed before this listener is called.
      void notifyContextInvalidated();
    }
  });
}
