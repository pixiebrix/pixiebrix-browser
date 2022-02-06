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

// extensionContext needs to be imported before webpack-target-webextension to
// ensure the webpack path is correct
import "@/extensionContext";

// Required for MV3; Service Workers don't have XMLHttpRequest
import "@/background/axiosFetch";

import "webext-dynamic-content-scripts";

import "@/background/messenger/registration";
import "@/development/autoreload";
import "@/messaging/external";
import "@/background/locator";
import "@/background/contextMenus";
import "@/background/browserAction";

import initInstaller from "@/background/installer";
import initNavigation from "@/background/navigation";
import initGoogle from "@/contrib/google/initGoogle";
import initFrames from "@/background/iframes";
import initExecutor from "@/background/executor";
import initContextMenus from "@/background/initContextMenus";
import initBrowserCommands from "@/background/initBrowserCommands";
import initDeploymentUpdater from "@/background/deployment";
import initFirefoxCompat from "@/background/firefoxCompat";
import activateBrowserActionIcon from "@/background/activateBrowserActionIcon";
import initActiveTabTracking from "@/background/activeTab";

initInstaller();
initNavigation();
initExecutor();
initGoogle();
initFrames();
initContextMenus();
initBrowserCommands();
initDeploymentUpdater();
void initFirefoxCompat();
activateBrowserActionIcon();
initActiveTabTracking();
