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

// Keep in order so precedence is preserved
import "@/vendors/theme/app/app.scss";
import "@/vendors/overrides.scss";
import "@/utils/layout.scss";
import "./sidebar.scss";

import "@/extensionContext";
import "@/development/darkMode.js";

import { initMessengerLogging } from "@/development/messengerLogging";
import registerMessenger from "@/sidebar/messenger/registration";
import App from "@/sidebar/SidebarApp";
import ReactDOM from "react-dom";
import React from "react";
import registerBuiltinBricks from "@/bricks/registerBuiltinBricks";
import registerContribBlocks from "@/contrib/registerContribBlocks";
import { initToaster } from "@/utils/notify";
import { initRuntimeLogging } from "@/development/runtimeLogging";
import { initCopilotMessenger } from "@/contrib/automationanywhere/aaFrameProtocol";
import { initPerformanceMonitoring } from "@/telemetry/performance";
import { initSidePanel } from "./sidePanel";
import { getConnectedTarget } from "@/sidebar/connectedTarget";
import { sidebarWasLoaded } from "@/contentScript/messenger/strict/api";
import { setPlatform } from "@/platform/platformContext";
import sidebarPlatform from "@/sidebar/sidebarPlatform";

setPlatform(sidebarPlatform);

async function init(): Promise<void> {
  ReactDOM.render(<App />, document.querySelector("#container"));
  sidebarWasLoaded(await getConnectedTarget());
}

void initMessengerLogging();
void initRuntimeLogging();
void initPerformanceMonitoring();
registerMessenger();
registerContribBlocks();
registerBuiltinBricks();
initToaster();
void init();
initSidePanel();

// Handle an embedded AA business copilot frame
void initCopilotMessenger();
