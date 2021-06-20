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

import {
  HandlerEntry,
  HandlerOptions,
  isErrorResponse,
  isNotification,
  RemoteProcedureCallRequest,
  SerializableResponse,
  toErrorResponse,
} from "@/messaging/protocol";
import { isBackgroundPage, isContentScript } from "webext-detect-page";
import { deserializeError } from "serialize-error";
import { browser, Runtime } from "webextension-polyfill-ts";

export const MESSAGE_PREFIX = "@@pixiebrix/contentScript/";
export const ROOT_FRAME_ID = 0;

export class ContentScriptActionError extends Error {
  errors: unknown;

  constructor(message: string) {
    super(message);
    this.name = "ContentScriptActionError";
  }
}

const handlers = new Map<string, HandlerEntry>();

export function allowSender(sender: Runtime.MessageSender): boolean {
  return sender.id === browser.runtime.id;
}

function contentScriptListener(
  request: RemoteProcedureCallRequest,
  sender: Runtime.MessageSender
): Promise<unknown> | undefined {
  const { type, payload } = request;
  const { handler, options } = handlers.get(type) ?? {};

  if (allowSender(sender) && handler) {
    console.debug(`Handling contentScript action ${type}`);

    const handlerPromise = new Promise((resolve) =>
      resolve(handler(...payload))
    );

    if (isNotification(options)) {
      return;
    } else {
      return handlerPromise.catch((reason) => {
        console.debug(`Handler returning error response for ${type}`, {
          reason,
        });
        return toErrorResponse(
          type,
          reason ?? new Error("Unknown error in content script handler")
        );
      });
    }
  }
}

async function getTabIds(): Promise<number[]> {
  const tabs = await browser.tabs.query({});
  return tabs.map((x) => x.id);
}

export function notifyContentScripts(
  type: string,
  method: () => void
): (tabId: number | null) => Promise<void>;
export function notifyContentScripts<T>(
  type: string,
  method: (a0: T) => void
): (tabId: number | null, a0: T) => Promise<void>;
export function notifyContentScripts<T0, T1>(
  type: string,
  method: (a0: T0, a1: T1) => void
): (tabId: number | null, a0: T0, a1: T1) => Promise<void>;
export function notifyContentScripts(
  type: string,
  method: (...args: unknown[]) => void
): (tabId: number | null, ...args: unknown[]) => Promise<void> {
  const fullType = `${MESSAGE_PREFIX}${type}`;

  if (isContentScript()) {
    // addContentScriptListener logs to console when the handler is installed on the window. So it would be confusing
    // to include a console.debug statement here
    handlers.set(fullType, {
      // HandlerEntry's Handler field has a return value, not void
      handler: method as (...args: unknown[]) => null,
      options: { asyncResponse: false },
    });
  }

  return async (tabId: number | null, ...args: unknown[]) => {
    if (!isBackgroundPage()) {
      throw new ContentScriptActionError(
        "This method can only be called from the background page"
      );
    }
    console.debug(
      `Broadcasting content script notification ${fullType} to tab: ${
        tabId ?? "<all>"
      }`
    );
    const messageOne = (tabId: number) =>
      browser.tabs.sendMessage(
        tabId,
        { type: fullType, payload: args },
        { frameId: ROOT_FRAME_ID }
      );
    const tabIds = tabId ? [tabId] : await getTabIds();
    Promise.all(tabIds.map(messageOne)).catch((reason) => {
      console.warn(
        `An error occurred when broadcasting content script notification ${fullType}`,
        reason
      );
    });
    return;
  };
}

export type Target = {
  tabId: number;
  frameId: number;
};

/**
 * Lift a method to be run in the contentScript
 * @param type a unique name for the contentScript action
 * @param method the method to lift
 * @param options contentScript action handler options
 */
export function liftContentScript<R extends SerializableResponse>(
  type: string,
  method: () => R | Promise<R>,
  options?: HandlerOptions
): (target: Target | null) => Promise<R>;
export function liftContentScript<T, R extends SerializableResponse>(
  type: string,
  method: (a0: T) => R | Promise<R>,
  options?: HandlerOptions
): (target: Target | null, a0: T) => Promise<R>;
export function liftContentScript<T0, T1, R extends SerializableResponse>(
  type: string,
  method: (a0: T0, a1: T1) => R | Promise<R>,
  options?: HandlerOptions
): (target: Target | null, a0: T0, a1: T1) => Promise<R>;
export function liftContentScript<T0, T1, T2, R extends SerializableResponse>(
  type: string,
  method: (a0: T0, a1: T1, a2: T2) => R | Promise<R>,
  options?: HandlerOptions
): (target: Target | null, a0: T0, a1: T1, a2: T2) => Promise<R>;
export function liftContentScript<
  T0,
  T1,
  T2,
  T3,
  R extends SerializableResponse
>(
  type: string,
  method: (a0: T0, a1: T1, a2: T2, a3: T3) => R,
  options?: HandlerOptions
): (target: Target | null, a0: T0, a1: T1, a2: T2, a3: T3) => Promise<R>;
export function liftContentScript<R extends SerializableResponse>(
  type: string,
  method: (...args: unknown[]) => R,
  options?: HandlerOptions
): (target: Target | null, ...args: unknown[]) => Promise<R> {
  const fullType = `${MESSAGE_PREFIX}${type}`;

  if (isContentScript()) {
    // addContentScriptListener logs to console when the handler is installed on the window. So it would be confusing
    // to include a console.debug statement here
    handlers.set(fullType, { handler: method, options });
  }

  return async (target: Target | null, ...args: unknown[]) => {
    if (isContentScript()) {
      console.debug("Resolving call from the contentScript immediately");
      return method(...args);
    } else if (!isBackgroundPage()) {
      throw new ContentScriptActionError(
        "Unexpected call from origin other than the background page"
      );
    }

    console.debug(
      `Sending content script action ${fullType} to tab ${
        target?.tabId ?? "<all>"
      }, frame ${target?.frameId ?? ROOT_FRAME_ID}`
    );

    let response;

    try {
      response = await browser.tabs.sendMessage(
        target?.tabId,
        {
          type: fullType,
          payload: args,
        },
        { frameId: target.frameId ?? ROOT_FRAME_ID }
      );
    } catch (err) {
      if (
        isNotification(options) &&
        err?.message.includes("Receiving end does not exist")
      ) {
        // Ignore the content script not being loaded
        return;
      }

      console.debug(
        `Error sending content script ${
          isNotification(options) ? "notification" : "action"
        } ${type}`,
        {
          target,
          err,
        }
      );

      if (isNotification(options)) {
        return;
      } else {
        throw err;
      }
    }

    if (isErrorResponse(response)) {
      throw deserializeError(response.$$error);
    }

    return response;
  };
}

function addContentScriptListener(): void {
  if (!isContentScript()) {
    throw new Error(
      "addContentScriptListener should only be run from the content script"
    );
  }

  browser.runtime.onMessage.addListener(contentScriptListener);
  console.debug(
    "Installed handlers for %d actions/notifications",
    handlers.size,
    {
      actions: Array.from(handlers.keys()),
    }
  );
}

export default addContentScriptListener;
