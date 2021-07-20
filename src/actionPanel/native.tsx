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

import { browser } from "webextension-polyfill-ts";
import { reportError } from "@/telemetry/logging";
import { v4 as uuidv4 } from "uuid";
import {
  ActionPanelStore,
  PanelEntry,
  RENDER_PANELS_MESSAGE,
  RendererError,
  RendererPayload,
} from "@/actionPanel/protocol";
import { FORWARD_FRAME_NOTIFICATION } from "@/background/browserAction";
import { isBrowser } from "@/helpers";
import { reportEvent } from "@/telemetry/events";
import { expectContentScript } from "@/utils/expectContext";

const SIDEBAR_WIDTH_PX = 400;
const PANEL_CONTAINER_ID = "pixiebrix-chrome-extension";
const PANEL_CONTAINER_SELECTOR = "#" + PANEL_CONTAINER_ID;

let renderSequenceNumber = 0;

type ExtensionRef = {
  extensionId: string;
  extensionPointId: string;
};

export type ShowCallback = () => void;

const panels: PanelEntry[] = [];
const extensionCallbacks: ShowCallback[] = [];
let originalMarginRight: number;

export function registerShowCallback(onShow: ShowCallback): void {
  extensionCallbacks.push(onShow);
}

export function removeShowCallback(onShow: ShowCallback): void {
  const index = extensionCallbacks.indexOf(onShow);
  if (index > -1) {
    extensionCallbacks.splice(index, 1);
  }
}

function getHTMLElement(): JQuery<HTMLElement> {
  // Resolve html tag, which is more dominant than <body>
  if (document.documentElement) {
    return $(document.documentElement);
  }

  if (document.querySelector("html")) {
    return $(document.querySelector("html"));
  }

  const $html = $("html");
  if ($html.length > 0) {
    return $html;
  }

  throw new Error("HTML node not found");
}

function storeOriginalCSS() {
  const $html = getHTMLElement();
  originalMarginRight = Number.parseFloat($html.css("margin-right"));
}

function adjustDocumentStyle(): void {
  const $html = getHTMLElement();
  $html.css("margin-right", `${originalMarginRight + SIDEBAR_WIDTH_PX}px`);
}

function restoreDocumentStyle(): void {
  const $html = getHTMLElement();
  $html.css("margin-right", originalMarginRight);
}

function insertActionPanel(): string {
  const nonce = uuidv4();

  const actionURL = browser.runtime.getURL("action.html");

  const $panelContainer = $(
    `<div id="${PANEL_CONTAINER_ID}" data-nonce="${nonce}" style="height: 100%; margin: 0; padding: 0; border-radius: 0; width: ${SIDEBAR_WIDTH_PX}px; position: fixed; top: 0; right: 0; z-index: 2147483647; border: 1px solid lightgray; background-color: rgb(255, 255, 255); display: block;"></div>`
  );

  // CSS approach not well supported? https://stackoverflow.com/questions/15494568/html-iframe-disable-scroll
  // eslint-disable-next-line capitalized-comments -- suppressing the IntelliJ warning 🐢
  // noinspection HtmlDeprecatedAttribute
  const $frame = $(
    `<iframe id="pixiebrix-frame" src="${actionURL}?nonce=${nonce}" style="height: 100%; width: ${SIDEBAR_WIDTH_PX}px" allowtransparency="false" frameborder="0" scrolling="no" ></iframe>`
  );

  $panelContainer.append($frame);

  $("body").append($panelContainer);

  return nonce;
}

export function showActionPanel(): string {
  reportEvent("SidePanelShow");

  adjustDocumentStyle();

  const container: HTMLElement = document.querySelector(
    PANEL_CONTAINER_SELECTOR
  );

  const nonce = container?.dataset?.nonce ?? insertActionPanel();

  // Run the extension points available on the page. If the action panel is already in the page, running
  // all the callbacks ensures the content is up to date
  for (const callback of extensionCallbacks) {
    try {
      void callback();
    } catch (error: unknown) {
      // The callbacks should each have their own error handling. But wrap in a try-catch to ensure running
      // the callbacks does not interfere prevent showing the sidebar
      reportError(error);
    }
  }

  return nonce;
}

export function hideActionPanel(): void {
  reportEvent("SidePanelHide");
  restoreDocumentStyle();
  $(PANEL_CONTAINER_SELECTOR).remove();
}

export function toggleActionPanel(): string | null {
  if (isActionPanelVisible()) {
    hideActionPanel();
    return null;
  }
  return showActionPanel();
}

export function isActionPanelVisible(): boolean {
  return document.querySelector(PANEL_CONTAINER_SELECTOR) != null;
}

export function getStore(): ActionPanelStore {
  return { panels };
}

function renderPanels() {
  expectContentScript();

  if (isActionPanelVisible()) {
    const seqNum = renderSequenceNumber;
    renderSequenceNumber++;

    void browser.runtime.sendMessage({
      type: FORWARD_FRAME_NOTIFICATION,
      meta: { $seq: seqNum },
      payload: {
        type: RENDER_PANELS_MESSAGE,
        payload: { panels },
      },
    });
  } else {
    console.debug(
      "Skipping renderPanels because the action panel is not visible"
    );
  }
}

export function removeExtension(extensionId: string): void {
  expectContentScript();

  // `panels` is const, so replace the contents
  const current = panels.splice(0, panels.length);
  panels.push(...current.filter((x) => x.extensionId !== extensionId));
  renderPanels();
}

export function removeExtensionPoint(extensionPointId: string): void {
  expectContentScript();

  // `panels` is const, so replace the contents
  const current = panels.splice(0, panels.length);
  panels.push(
    ...current.filter((x) => x.extensionPointId !== extensionPointId)
  );
  renderPanels();
}

/**
 * Create placeholder panels showing loading indicators
 */
export function reservePanels(refs: ExtensionRef[]): void {
  if (refs.length === 0) {
    return;
  }

  const current = new Set(panels.map((x) => x.extensionId));
  for (const { extensionId, extensionPointId } of refs) {
    if (!current.has(extensionId)) {
      const entry: PanelEntry = {
        extensionId,
        extensionPointId,
        heading: null,
        payload: null,
      };

      console.debug(
        "reservePanels: reserve panel %s for %s",
        extensionId,
        extensionPointId,
        { ...entry }
      );

      panels.push(entry);
    }
  }

  renderPanels();
}

export function updateHeading(extensionId: string, heading: string): void {
  const entry = panels.find((x) => x.extensionId === extensionId);
  if (entry) {
    entry.heading = heading;
    console.debug(
      "updateHeading: update heading for panel %s for %s",
      extensionId,
      entry.extensionPointId,
      { ...entry }
    );
    renderPanels();
  } else {
    console.warn(
      `updateHeading: No panel exists for extension %s`,
      extensionId
    );
  }
}

export function upsertPanel(
  { extensionId, extensionPointId }: ExtensionRef,
  heading: string,
  payload: RendererPayload | RendererError
): void {
  const entry = panels.find((panel) => panel.extensionId === extensionId);
  if (entry) {
    // XXX: should we update the heading here too?
    entry.payload = payload;
    console.debug(
      "upsertPanel: update existing panel %s for %s",
      extensionId,
      extensionPointId,
      { ...entry }
    );
  } else {
    console.debug(
      "upsertPanel: add new panel %s for %s",
      extensionId,
      extensionPointId,
      {
        entry,
        extensionPointId,
        heading,
        payload,
      }
    );
    panels.push({ extensionId, extensionPointId, heading, payload });
  }

  renderPanels();
}

if (isBrowser) {
  storeOriginalCSS();
}
