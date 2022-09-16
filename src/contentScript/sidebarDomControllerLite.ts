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

/**
 * @file This file MUST not have dependencies as it's meant to be tiny
 * and imported by browserActionInstantHandler.ts
 */

import { MAX_Z_INDEX, PANEL_FRAME_ID } from "@/common";

export const SIDEBAR_WIDTH_CSS_PROPERTY = "--pb-sidebar-margin-right";

const html = globalThis.document?.documentElement;
let originalMarginRight: number;
const SIDEBAR_WIDTH_PX = 400;

function storeOriginalCSSOnce() {
  originalMarginRight ??= Number.parseFloat(
    getComputedStyle(html).getPropertyValue("margin-right")
  );
}

const getSidebar = (): Element => document.querySelector(`#${PANEL_FRAME_ID}`);

export const isSidebarFrameVisible = (): boolean => Boolean(getSidebar());

/** Removes the element; Returns false if no element was found */
export function removeSidebarFrame(): boolean {
  const sidebar = getSidebar();
  if (sidebar) {
    sidebar.remove();
    Object.assign(html.style, {
      marginRight: `${originalMarginRight}px`,
      [SIDEBAR_WIDTH_CSS_PROPERTY]: "",
    });
  }

  return Boolean(sidebar);
}

/** Inserts the element; Returns false if it already existed */
export function insertSidebarFrame(): boolean {
  if (isSidebarFrameVisible()) {
    return false;
  }

  console.debug("SidePanel is not on the page, attaching side panel");

  storeOriginalCSSOnce();
  const nonce = crypto.randomUUID();
  const actionURL = browser.runtime.getURL("sidebar.html");

  html.style.setProperty("margin-right", `var(${SIDEBAR_WIDTH_CSS_PROPERTY})`);
  html.style.setProperty(
    SIDEBAR_WIDTH_CSS_PROPERTY,
    `${originalMarginRight + SIDEBAR_WIDTH_PX}px`
  );

  const iframe = document.createElement("iframe");
  Object.assign(iframe, {
    id: PANEL_FRAME_ID,
    src: `${actionURL}?nonce=${nonce}`,
    "data-nonce": nonce,
  });
  Object.assign(iframe.style, {
    position: "fixed",
    top: 0,
    right: 0,
    zIndex: MAX_Z_INDEX,
    width: `${SIDEBAR_WIDTH_PX}px`,
    height: "100%",
    border: 0,
    borderLeft: "1px solid lightgray",
    background: "#f2edf3",
  });
  html.append(iframe);

  return true;
}

export function toggleSidebarFrame(): boolean {
  if (isSidebarFrameVisible()) {
    removeSidebarFrame();
    return false;
  }

  insertSidebarFrame();
  return true;
}
