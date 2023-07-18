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

// extensionContext needs to be imported before webpack-target-webextension to
// ensure the webpack path is correct
import "@/extensionContext";
import "@/development/autoreload";
import "@/development/errorsBadge";

// Required for MV3; Service Workers don't have XMLHttpRequest
import "@/background/axiosFetch";

import registerMessenger from "@/background/messenger/registration";
import registerExternalMessenger from "@/background/messenger/external/registration";
import initLocator from "@/background/locator";
import initContextMenus from "@/background/contextMenus";
import initBrowserAction from "@/background/browserAction";
import initInstaller from "@/background/installer";
import initNavigation from "@/background/navigation";
import initGoogle, { isGAPISupported } from "@/contrib/google/initGoogle";
import initExecutor from "@/background/executor";
import initBrowserCommands from "@/background/initBrowserCommands";
import initDeploymentUpdater from "@/background/deploymentUpdater";
import initFirefoxCompat from "@/background/firefoxCompat";
import activateBrowserActionIcon from "@/background/activateBrowserActionIcon";
import initPartnerTheme from "@/background/partnerTheme";
import initStarterBlueprints from "@/background/starterBlueprints";
import { initPartnerTokenRefresh } from "@/background/partnerIntegrations";
import { initContentScriptReadyListener } from "@/background/contentScript";
import { initLogSweep } from "@/telemetry/logging";
import { initModUpdater } from "@/background/modUpdater";

void initLocator();
registerMessenger();
registerExternalMessenger();
initBrowserAction();
initInstaller();
initNavigation();
initExecutor();
initContextMenus();
initContentScriptReadyListener();
initBrowserCommands();
initDeploymentUpdater();
initFirefoxCompat();
activateBrowserActionIcon();
initPartnerTheme();
initStarterBlueprints();
initPartnerTokenRefresh();
initLogSweep();
initModUpdater();

if (isGAPISupported()) {
  // Optimistically initialize Google API, if Google API is supported. But do not prompt for permissions
  void initGoogle();
} else {
  console.debug("Google API not supported by browser", {
    // @ts-expect-error -- exists on Chromium, but not other browsers
    browserBrands: navigator.userAgentData?.brands,
  });
}
