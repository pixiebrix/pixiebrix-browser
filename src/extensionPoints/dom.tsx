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

import React from "react";
import ReactDOM from "react-dom";

export interface ComponentRef {
  Component: React.FunctionComponent;
  props: Record<string, unknown>;
}

interface RenderOptions {
  shadowDOM: boolean;
}

export type PanelComponent = string | ComponentRef;

export function render(
  root: HTMLElement,
  body: PanelComponent,
  { shadowDOM }: RenderOptions
): void {
  console.debug("render: panel body");

  if (typeof body === "string") {
    if (shadowDOM) {
      const shadowRoot = root.attachShadow({ mode: "closed" });
      shadowRoot.innerHTML = body;
    } else {
      $(root).html(body);
    }
  } else {
    // Consider using https://github.com/Wildhoney/ReactShadow or similar if we have problems with events
    const { Component, props } = body;
    if (shadowDOM) {
      const shadowRoot = root.attachShadow({ mode: "closed" });
      ReactDOM.render(<Component {...props} />, shadowRoot);
    } else {
      ReactDOM.render(<Component {...props} />, root);
    }
  }
}
