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

// https://developer.chrome.com/extensions/devtools

import { browser } from "webextension-polyfill-ts";
import { connectDevtools } from "@/devTools/protocol";
import { readSelectedElement } from "@/background/devtools";
import { reportError } from "@/telemetry/logging";
import { updateSelectedElement } from "./devTools/getSelectedElement";
import { once } from "lodash";
import { serializeError } from "serialize-error";

// TODO: Ensure that reportError can handle ErrorEvent
window.addEventListener("error", reportError);
window.addEventListener("unhandledrejection", reportError);

async function updateElementProperties(): Promise<void> {
  const { sidebar, port } = await connectSidebarPane();
  void sidebar.setObject({ state: "loading..." });
  try {
    await updateSelectedElement();
    await sidebar.setObject(await readSelectedElement(port));
  } catch (error: unknown) {
    await sidebar.setObject({ error: serializeError(error) });
  }
}

function onSidebarShow() {
  chrome.devtools.panels.elements.onSelectionChanged.addListener(
    updateElementProperties
  );

  void updateElementProperties();
}

function onSidebarHide() {
  chrome.devtools.panels.elements.onSelectionChanged.removeListener(
    updateElementProperties
  );
}

// This only ever needs to run once per devtools load. Sidebar and port will be constant throughout
const connectSidebarPane = once(async () => {
  const [sidebar, port] = await Promise.all([
    browser.devtools.panels.elements.createSidebarPane("PixieBrix Data Viewer"),
    connectDevtools(),
  ]);

  sidebar.onShown.addListener(onSidebarShow);
  sidebar.onHidden.addListener(onSidebarHide);

  console.debug("DevTools sidebar ready");
  return { sidebar, port };
});

if (browser.devtools.inspectedWindow.tabId) {
  void browser.devtools.panels.create("PixieBrix", "", "devtoolsPanel.html");
  void connectSidebarPane();
}
