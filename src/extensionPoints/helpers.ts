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

import { castArray, noop, once } from "lodash";
// @ts-ignore: no type definitions
import initialize from "vendors/initialize";
import { sleep, waitAnimationFrame } from "@/utils";

export const EXTENSION_POINT_DATA_ATTR = "data-pb-extension-point";

export function isHost(hostname: string): boolean {
  return (
    window.location.hostname === hostname ||
    window.location.hostname.endsWith(`.${hostname}`)
  );
}

function getAncestors(node: Node): Node[] {
  const ancestors = [node];
  let currentNode: Node = node;
  while (currentNode && currentNode != document) {
    ancestors.push(currentNode);
    currentNode = currentNode.parentNode;
  }
  return ancestors;
}

export function onNodeRemoved(node: Node, callback: () => void): () => void {
  const ancestors = getAncestors(node);

  const nodes = new WeakSet<Node>(ancestors);
  const observers = new Set<MutationObserver>();

  // make sure we're only calling once
  const wrappedCallback = once(callback);

  // Observe the whole path to the node. A node is removed if any of its ancestors are removed. Observe individual
  // nodes instead of the subtree on the document for efficiency on wide trees
  for (const ancestor of ancestors) {
    if (ancestor && ancestor.parentNode) {
      // https://stackoverflow.com/a/50397148/
      const removalObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          // https://stackoverflow.com/questions/51723962/typescript-nodelistofelement-is-not-an-array-type-or-a-string-type
          for (const removedNode of (mutation.removedNodes as any) as Iterable<Node>) {
            if (nodes.has(removedNode)) {
              for (const observer of observers) {
                try {
                  observer.disconnect();
                } catch (error) {
                  console.warn("Error disconnecting mutation observer", error);
                }
              }
              wrappedCallback();
              break;
            }
          }
        }
      });
      removalObserver.observe(ancestor.parentNode, { childList: true });
    }
  }

  return () => {
    for (const observer of observers) {
      try {
        observer.disconnect();
      } catch (error) {
        console.warn("Error disconnecting mutation observer", error);
      }
    }
    observers.clear();
  };
}

/**
 * Returns true if the browser natively supports the CSS selector
 */
function isNativeCssSelector(selector: string): boolean {
  try {
    document.querySelector(selector);
    return true;
  } catch {
    return false;
  }
}

export class PromiseCancelled extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromiseCancelled";
  }
}

async function _wait<T>(
  factory: () => T,
  isCancelled: () => boolean,
  waitMillis = 100
): Promise<T> {
  let value = factory();
  while (value == null) {
    if (isCancelled()) {
      throw new PromiseCancelled("Cancelled waiting for element");
    }
    if (waitMillis != null) {
      await sleep(waitMillis);
    }
    await waitAnimationFrame();
    value = factory();
  }
  return value;
}

function pollSelector(
  selector: string,
  target: HTMLElement | Document,
  waitMillis = 100
): [Promise<JQuery<HTMLElement>>, () => void] {
  console.debug(`Polling for selector ${selector}`);
  let cancelled = false;
  const $target = $(target);
  const promise = _wait<JQuery<HTMLElement>>(
    () => {
      const $elt = $target.find(selector);
      return $elt.length > 0 ? $elt : null;
    },
    () => cancelled,
    waitMillis
  );
  return [
    promise,
    () => {
      cancelled = true;
    },
  ];
}

function mutationSelector(
  selector: string,
  target?: HTMLElement | Document
): [Promise<JQuery<HTMLElement>>, () => void] {
  let observer: MutationObserver;
  const promise = new Promise<JQuery<HTMLElement>>((resolve) => {
    // @ts-ignore: no type signatures
    observer = initialize(
      selector,
      function () {
        resolve($(this));
      },
      { target: target ?? document }
    );
  });
  return [promise, () => observer?.disconnect()];
}

function _initialize(
  selector: string,
  target: HTMLElement | Document,
  waitMillis = 100
): [Promise<JQuery<HTMLElement | Document>>, () => void] {
  if (isNativeCssSelector(selector)) {
    return mutationSelector(selector, target);
  } else {
    return pollSelector(selector, target, waitMillis);
  }
}

/**
 * Recursively await an element using one or more JQuery selectors.
 * @param selector
 * @param rootElement
 */
export function awaitElementOnce(
  selector: string | string[],
  rootElement: JQuery<HTMLElement | Document> = undefined
): [Promise<JQuery<HTMLElement | Document>>, () => void] {
  if (selector == null) {
    throw new Error("awaitElementOnce expected selector");
  }

  const selectors = castArray(selector);
  const $root = rootElement ? $(rootElement) : $(document);

  if (selectors.length === 0) {
    return [Promise.resolve($root), noop];
  }

  // console.debug("Awaiting selectors", selectors);

  const [nextSelector, ...rest] = selectors;

  // find immediately, or wait for it to be initialized
  const $element: JQuery<HTMLElement | Document> = $root.find(nextSelector);

  if ($element.length === 0) {
    console.debug(
      `Selector not immediately found; awaiting selector: ${nextSelector}`
    );

    const [nextElementPromise, cancel] = _initialize(
      nextSelector,
      $root.get(0)
    );
    let innerCancel = noop;
    return [
      nextElementPromise.then(($nextElement) => {
        const [innerPromise, inner] = awaitElementOnce(rest, $nextElement);
        innerCancel = inner;
        return innerPromise;
      }),
      () => {
        cancel();
        innerCancel();
      },
    ];
  } else if (rest.length === 0) {
    return [Promise.resolve($element), noop];
  } else {
    return awaitElementOnce(rest, $element);
  }
}

/**
 * Marks extensionPointId as owning a DOM element.
 * @param element the element to acquire
 * @param extensionPointId the owner extension ID
 * @param onRemove callback to call when the element is removed from the DOM
 */
export function acquireElement(
  element: HTMLElement,
  extensionPointId: string,
  onRemove: () => void
): () => void | null {
  const existing = element.getAttribute(EXTENSION_POINT_DATA_ATTR);
  if (existing) {
    if (extensionPointId !== existing) {
      console.warn(
        `acquireElement: cannot acquire for ${extensionPointId} because it has extension point ${existing} attached to it`
      );
      return null;
    }
    console.debug(
      `acquireElement: re-acquiring element for ${extensionPointId}`
    );
  }
  element.setAttribute(EXTENSION_POINT_DATA_ATTR, extensionPointId);
  return onNodeRemoved(element, onRemove);
}

export function getErrorMessage(ex: Error): string {
  if ("message" in ex && ex.message) {
    return ex.message;
  }
  return ex.toString();
}
