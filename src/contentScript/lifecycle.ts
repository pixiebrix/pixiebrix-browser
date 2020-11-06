/*
 * Copyright (C) 2020 Pixie Brix, LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { loadOptions } from "@/options/loader";
import blockRegistry from "@/blocks/registry";
import extensionPointRegistry from "@/extensionPoints/registry";
import { IExtensionPoint } from "@/core";

import serviceRegistry from "@/services/registry";
import {
  liftContentScript,
  notifyContentScripts,
} from "@/contentScript/backgroundProtocol";

let _loadedBlocks = false;
let _scriptPromise: Promise<void>;
let _extensionPoints: IExtensionPoint[] = undefined;
let _navSequence = 1;

// @ts-ignore: may use in the future to determine which extension points to install
let _openerTabId: number = undefined;

export async function loadBlocks(): Promise<void> {
  await Promise.all([
    blockRegistry.refresh({ allowFetch: false }),
    extensionPointRegistry.refresh({ allowFetch: false }),
    serviceRegistry.refresh({ allowFetch: false }),
  ]);
}

async function loadBlocksOnce(): Promise<void> {
  if (!_loadedBlocks) {
    await loadBlocks();
    _loadedBlocks = true;
  }
}

async function installScriptOnce(): Promise<void> {
  // https://stackoverflow.com/questions/9515704/insert-code-into-the-page-context-using-a-content-script/9517879#9517879
  // https://stackoverflow.com/questions/9602022/chrome-extension-retrieving-global-variable-from-webpage
  if (!_scriptPromise) {
    console.debug("Installing page script");
    _scriptPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = chrome.extension.getURL("script.js");
      (document.head || document.documentElement).appendChild(script);
      script.onload = function () {
        script.remove();
        console.debug("Installed page script");
        resolve();
      };
    });
  }
  return _scriptPromise;
}

async function runExtensionPoint(
  extensionPoint: IExtensionPoint,
  isCancelled: () => boolean
): Promise<void> {
  const installed = await extensionPoint.install();

  if (!installed) {
    console.debug(
      `Skipping ${extensionPoint.id} because it was not installed on the page`
    );
    return;
  } else if (isCancelled()) {
    console.debug(
      `Skipping ${extensionPoint.id} because user navigated away from the page`
    );
    return;
  }

  await extensionPoint.run();
}

async function loadExtensions() {
  _extensionPoints = [];

  const { extensions: extensionPointConfigs } = await loadOptions();

  for (const [extensionPointId, extensions] of Object.entries(
    extensionPointConfigs
  )) {
    try {
      const extensionPoint = extensionPointRegistry.lookup(extensionPointId);
      const activeExtensions = Object.values(extensions).filter(
        (x) => x.active
      );

      let added = false;
      for (const extension of activeExtensions) {
        extensionPoint.addExtension(extension);
        added = true;
      }

      if (added) {
        _extensionPoints.push(extensionPoint);
      }
    } catch (err) {
      console.warn(`Error adding extension point ${extensionPointId}`);
    }
  }
}

async function loadExtensionsOnce() {
  if (_extensionPoints == null) {
    await loadExtensions();
  }
  return _extensionPoints;
}

function getNavSequence() {
  return _navSequence;
}

/**
 * Handle a website navigation, e.g., page load or a URL change in an SPA.
 * @returns {Promise<void>}
 */
export async function handleNavigate(openerTabId?: number): Promise<void> {
  console.debug(`Handling navigation to ${location.href}`);
  await installScriptOnce();
  await loadBlocksOnce();
  const extensionPoints = await loadExtensionsOnce();

  if (openerTabId) {
    console.debug(`Setting opener tabId: ${openerTabId}`);
    _openerTabId = openerTabId;
  }

  if (extensionPoints.length) {
    _navSequence++;
    const currentNavSequence = _navSequence;
    const cancel = () => getNavSequence() > currentNavSequence;

    for (const extensionPoint of extensionPoints) {
      // Don't await each extension point since the extension point may never appear. For example, an
      // extension point that runs on the contact information page on LinkedIn
      // eslint-disable-next-line require-await
      runExtensionPoint(extensionPoint, cancel);
    }
  }
}

export const notifyNavigation = liftContentScript(
  "NAVIGATE",
  (openerTabId?: number) => handleNavigate(openerTabId),
  { asyncResponse: false }
);

export const reactivate = notifyContentScripts("REACTIVATE", async () => {
  await loadBlocks();
  await loadExtensions();
  await handleNavigate();
});
