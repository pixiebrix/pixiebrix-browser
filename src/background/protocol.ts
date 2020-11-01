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

import { getChromeExtensionId, RuntimeNotFoundError } from "@/chrome";
// @ts-ignore: types not defined for match-pattern
import matchPattern from "match-pattern";

import {
  isBackgroundPage,
  isContentScript,
  isOptionsPage,
} from "webext-detect-page";
import { deserializeError } from "serialize-error";
import { isEmpty, partial } from "lodash";

import {
  HandlerEntry,
  SerializableResponse,
  HandlerOptions,
  toErrorResponse,
  isErrorResponse,
  RemoteProcedureCallRequest,
} from "@/messaging/protocol";

type MessageSender = chrome.runtime.MessageSender;

const MESSAGE_PREFIX = "@@pixiebrix/background/";

export class BackgroundActionError extends Error {
  errors: unknown;

  constructor(message: string) {
    super(message);
    this.name = "BackgroundActionError";
  }
}

const handlers: { [key: string]: HandlerEntry } = {};

/**
 * Return true if a message sender is either the extension itself, or an externally connectable page
 * https://developer.chrome.com/extensions/security#sanitize
 */
function allowSender(sender: MessageSender): boolean {
  const { externally_connectable } = chrome.runtime.getManifest();
  return (
    sender.id === chrome.runtime.id ||
    externally_connectable.matches.some((x) =>
      matchPattern.parse(x).test(sender.origin)
    )
  );
}

function handleRequest(
  request: RemoteProcedureCallRequest,
  sender: MessageSender,
  sendResponse: (response: unknown) => void
): boolean {
  if (!allowSender(sender)) {
    console.debug(
      `Ignoring message to background page from unknown sender`,
      sender
    );
    return false;
  }

  const { handler, options: { asyncResponse } = { asyncResponse: true } } =
    handlers[request.type] ?? {};

  if (handler) {
    console.debug(`Handling background action ${request.type}`);
    const handlerPromise = new Promise((resolve) =>
      resolve(handler(...request.payload))
    );
    handlerPromise
      .then((x) => {
        if (asyncResponse) {
          console.debug(
            `Handler returning success response for ${request.type}`
          );
          sendResponse(x);
        }
      })
      .catch((reason) => {
        if (asyncResponse) {
          console.debug(`Handler returning error response for ${request.type}`);
          sendResponse(toErrorResponse(request.type, reason));
        } else {
          console.warn(
            `An error occurred while handling a notification ${request.type}`,
            reason
          );
        }
      });
    return asyncResponse;
  } else if (request.type.startsWith(MESSAGE_PREFIX)) {
    console.warn(`No handler installed for message ${request.type}`);
  }
  return false;
}

function getExternalSendMessage() {
  const extensionId = getChromeExtensionId();
  if (chrome.runtime == null) {
    throw new RuntimeNotFoundError(
      "Chrome runtime is unavailable; is the extension externally connectable?"
    );
  } else if (isEmpty(extensionId)) {
    throw new Error("Could not find chrome extension id");
  }
  return partial(chrome.runtime.sendMessage, extensionId);
}

export function getSendMessage(): (
  request: RemoteProcedureCallRequest,
  callback: (response: unknown) => void
) => void {
  // type signatures for sendMessage are wrong w.r.t. the message options param
  return (isContentScript() || isOptionsPage()
    ? chrome.runtime.sendMessage
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getExternalSendMessage()) as any;
}

export function send(
  type: string,
  args: unknown[],
  options: HandlerOptions
): Promise<unknown> {
  const sendMessage = getSendMessage();

  return new Promise((resolve, reject) => {
    sendMessage({ type, payload: args }, function (response: unknown) {
      if (chrome.runtime.lastError != null) {
        reject(new BackgroundActionError(chrome.runtime.lastError.message));
      } else if (isErrorResponse(response)) {
        reject(deserializeError(response.$$error));
      } else {
        resolve(response as unknown);
      }
    });
    if (chrome.runtime.lastError != null) {
      reject(new BackgroundActionError(chrome.runtime.lastError.message));
    } else if (!(options?.asyncResponse ?? true)) {
      resolve();
    }
  });
}

/**
 * Lift a method to be run on the background page
 * @param type a unique name for the background action
 * @param method the method to lift
 * @param options background action handler options
 */
export function liftBackground<R extends SerializableResponse>(
  type: string,
  method: () => R,
  options?: HandlerOptions
): () => Promise<R>;
export function liftBackground<T, R extends SerializableResponse>(
  type: string,
  method: (a0: T) => R,
  options?: HandlerOptions
): (a0: T) => Promise<R>;
export function liftBackground<T0, T1, R extends SerializableResponse>(
  type: string,
  method: (a0: T0, a1: T1) => R,
  options?: HandlerOptions
): (a0: T0, a1: T1) => Promise<R>;
export function liftBackground<T0, T1, T2, R extends SerializableResponse>(
  type: string,
  method: (a0: T0, a1: T1, a2: T2) => R,
  options?: HandlerOptions
): (a0: T0, a1: T1, a2: T2) => Promise<R>;
export function liftBackground<T0, T1, T2, T3, R extends SerializableResponse>(
  type: string,
  method: (a0: T0, a1: T1, a2: T2, a3: T3) => R,
  options?: HandlerOptions
): (a0: T0, a1: T1, a2: T2, a3: T3) => Promise<R>;
export function liftBackground<R extends SerializableResponse>(
  type: string,
  method: (...args: unknown[]) => R,
  options?: HandlerOptions
): (...args: unknown[]) => Promise<R> {
  const fullType = `${MESSAGE_PREFIX}${type}`;

  if (isBackgroundPage()) {
    console.debug(`Installed background page handler for ${type}`);
    handlers[fullType] = { handler: method, options };
  } else {
    // console.debug(`Not the background page (context: ${type})`);
  }

  return async (...args: unknown[]) => {
    if (isBackgroundPage()) {
      return Promise.resolve(method(...args));
    }
    console.debug(`Sending background action ${fullType}`);
    return (await send(fullType, args, options)) as any;
  };
}

if (isBackgroundPage()) {
  chrome.runtime.onMessage.addListener(handleRequest);
  chrome.runtime.onMessageExternal.addListener(handleRequest);
}
