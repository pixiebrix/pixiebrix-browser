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

declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}
declare module "*.module.scss" {
  const classes: Record<string, string>;
  export default classes;
}

declare module "react-select-virtualized" {
  import VirtualizedSelect from "react-virtualized-select";
  export default VirtualizedSelect;
}

declare module "generate-schema" {
  import { UnknownObject } from "@/types";
  const json: (title: string, obj: unknown) => UnknownObject;
}

declare module "@/vendors/initialize" {
  /** Attach a MutationObserver specifically for a selector */
  const initialize: (
    selector: string,
    callback: (this: Element, index: number, element: Element) => void | false,
    options?: { target?: Element | Document; observer?: MutationObserverInit }
  ) => MutationObserver;

  export default initialize;
}

// Missing from TS types, but it's a standard
interface HTMLDialogElement extends HTMLElement {
  showModal(): void;
}
