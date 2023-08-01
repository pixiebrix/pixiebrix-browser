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

import {
  getErrorMessage,
  JQUERY_INVALID_SELECTOR_ERROR,
} from "@/errors/errorHelpers";
import {
  BusinessError,
  InvalidSelectorError,
  MultipleElementsFoundError,
  NoElementsFoundError,
} from "@/errors/businessErrors";
import { sleep } from "@/utils/timeUtils";

/**
 * Find an element(s) by its jQuery selector. A safe alternative to $(selector), which constructs an element if it's
 * passed HTML.
 * @param selector a jQuery selector
 * @param parent parent element to search (default=document)
 */
export function $safeFind<Element extends HTMLElement>(
  selector: string,
  parent: Document | HTMLElement | JQuery<HTMLElement | Document> = document
): JQuery<Element> {
  try {
    return $(parent).find<Element>(selector);
  } catch (error) {
    const message = getErrorMessage(error);
    if (message.startsWith(JQUERY_INVALID_SELECTOR_ERROR)) {
      throw new InvalidSelectorError(message, selector);
    }

    throw error;
  }
}

/**
 * Returns exactly one HTMLElement corresponding to the given selector.
 * @param selector the jQuery selector
 * @param parent an optional parent element to search within
 * @throws NoElementsFoundError if not elements are found
 * @throws MultipleElementsFoundError if multiple elements are found
 */
export function findSingleElement<Element extends HTMLElement>(
  selector: string,
  parent: Document | HTMLElement | JQuery<HTMLElement | Document> = document
): Element {
  const $elements = $(parent).find<Element>(selector);
  return assertSingleElement($elements, selector);
}

/**
 * Returns exactly one HTMLElement from the JQuery collection.
 * @param $elements the JQuery collection
 * @param selector the jQuery selector that generated the collection
 * @throws NoElementsFoundError if not elements are found
 * @throws MultipleElementsFoundError if multiple elements are found
 */
export function assertSingleElement<Element extends HTMLElement>(
  $elements: JQuery<HTMLElement | Document>,
  selector?: string
): Element {
  if ($elements.length === 0) {
    throw new NoElementsFoundError(selector);
  }

  if ($elements.length > 1) {
    throw new MultipleElementsFoundError(selector);
  }

  const element = $elements.get(0);

  if (element === document) {
    throw new BusinessError("Expected an element, received the document");
  }

  return element as Element;
}

// Enables highlighting/prettifying when used as html`<div>` or css`.a {}`
// https://prettier.io/blog/2020/08/24/2.1.0.html
function concatenateTemplateLiteralTag(
  strings: TemplateStringsArray,
  ...keys: string[]
): string {
  return strings
    .map((string, i) => string + (i < keys.length ? keys[i] : ""))
    .join("");
}

export const html = concatenateTemplateLiteralTag;
export const css = concatenateTemplateLiteralTag;

export async function waitAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      resolve();
    });
  });
}

export async function setAnimationFrameInterval(
  callback: () => void,
  { signal }: { signal: AbortSignal }
): Promise<void> {
  while (!signal.aborted) {
    // eslint-disable-next-line no-await-in-loop -- intentional
    await waitAnimationFrame();
    callback();
  }
}

export async function waitForBody(): Promise<void> {
  while (!document.body) {
    // eslint-disable-next-line no-await-in-loop -- Polling pattern
    await sleep(20);
  }
}
