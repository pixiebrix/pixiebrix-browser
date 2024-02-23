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

import { getErrorMessage } from "@/errors/errorHelpers";
import {
  BusinessError,
  InvalidSelectorError,
  MultipleElementsFoundError,
  NoElementsFoundError,
} from "@/errors/businessErrors";
import { sleep } from "@/utils/timeUtils";
import { JQUERY_INVALID_SELECTOR_ERROR } from "@/errors/knownErrorMessages";
import pDefer, { type DeferredPromise } from "p-defer";
import type { Nullishable } from "@/utils/nullishUtils";

/**
 * Find an element(s) by its jQuery selector. A safe alternative to $(selector), which constructs an element if it's
 * passed HTML.
 * @param selector a jQuery selector
 * @param parent parent element to search (default=document)
 */
export function $safeFind<Element extends HTMLElement>(
  selector: string,
  parent: Document | HTMLElement | JQuery<HTMLElement | Document> = document,
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
  parent: Document | HTMLElement | JQuery<HTMLElement | Document> = document,
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
  selector: string,
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

/**
 * Promise-based wrapper around window.requestAnimationFrame.
 * https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame
 */
export async function waitAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      resolve();
    });
  });
}

/**
 * Run a callback on each animation frame until the signal is aborted.
 * @param callback the callback to run
 * @param signal the abort signal
 */
export async function setAnimationFrameInterval(
  callback: () => void,
  { signal }: { signal: AbortSignal },
): Promise<void> {
  while (!signal.aborted) {
    // eslint-disable-next-line no-await-in-loop -- intentional
    await waitAnimationFrame();
    callback();
  }
}

/**
 * Wait for the document body element to be present.
 */
export async function waitForBody(): Promise<void> {
  while (!document.body) {
    // eslint-disable-next-line no-await-in-loop -- Polling pattern
    await sleep(20);
  }
}

/**
 * Return true if the element is visible in the viewport.
 * @param element the element to check
 */
export function isVisible(element: HTMLElement): boolean {
  // https://github.com/jquery/jquery/blob/c66d4700dcf98efccb04061d575e242d28741223/src/css/hiddenVisibleSelectors.js#L9C1-L9C1
  return Boolean(
    element.offsetWidth ||
      element.offsetHeight ||
      element.getClientRects().length > 0,
  );
}

/**
 * Returns a callback that runs only when the document is visible.
 * - If the document is visible, runs immediately
 * - If the document hidden, runs the trailing invocation when the document becomes visible
 * @param fn the function to run
 */
export function runOnDocumentVisible<Args extends unknown[], TReturn = unknown>(
  fn: (...args: Args) => TReturn,
): (...args: Args) => Promise<TReturn> {
  let deferredPromise: Nullishable<DeferredPromise<TReturn>>;
  let trailingArgs: Nullishable<Args>;

  async function runOnce(...args: Args): Promise<TReturn> {
    if (document.hidden) {
      if (deferredPromise) {
        // Coalesce multiple and prefer the trailing invocation arguments
        trailingArgs = args;
        return deferredPromise.promise;
      }

      deferredPromise = pDefer();
      trailingArgs = args;

      console.debug("runOnDocumentVisible: waiting for visibilitychange");

      document.addEventListener(
        "visibilitychange",
        async () => {
          console.debug("runOnDocumentVisible: visibilitychange", {
            visibilityState: document.visibilityState,
          });

          if (
            // Defensive check that the listener is only called when the document becomes visible. Should always be
            // true because the listener is added when the document is hidden.
            document.visibilityState === "visible" &&
            // Defensive check for NPEs. In practice, these should always be defined because they're only unset
            // when the listener runs. Using "!" was causing spurious TS errors.
            deferredPromise &&
            trailingArgs
          ) {
            try {
              deferredPromise.resolve(fn(...trailingArgs));
            } catch (error) {
              deferredPromise.reject(error);
            } finally {
              deferredPromise = undefined;
              trailingArgs = undefined;
            }
          }
        },
        // Safe to use "once" here even though visibilitychange fires for both visible/non-visible. The listener
        // is added when the document is hidden so the only time it will fire is when the document becomes visible
        { once: true },
      );

      return deferredPromise.promise;
    }

    // Run immediately if the document is visible
    return fn(...args);
  }

  return runOnce;
}
