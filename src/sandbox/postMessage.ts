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

/**
 * @file and security
 * 1. The content script generates an iframe with a local document.
 * 2. postMessage only works with `"*"` in this direction
 *    https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#using_window.postmessage_in_extensions_non-standard
 * 3. The iframe is safe because it's local and wrapped in a Shadow DOM,
 *    thus inaccessible/not-alterable by the host website.
 * 4. Each content script message includes a private channel port that the
 *    iframe can use to respond exclusively to the content script.
 * 5. The channel is closed immediately after the response.
 *
 * Prior art: https://groups.google.com/a/chromium.org/g/chromium-extensions/c/IPJSfjNSgh8/m/Dh35-tZPAgAJ
 * Relevant discussion: https://github.com/w3c/webextensions/issues/78
 */

import pTimeout, { TimeoutError } from "p-timeout";
import { deserializeError, serializeError } from "serialize-error";
import { type SerializedError } from "@/types/messengerTypes";
import { type JsonValue } from "type-fest";
import { assertNotNullish } from "@/utils/nullishUtils";
import { type AbortSignalAsOptions } from "@/utils/promiseUtils";
import { uuidv4 } from "@/types/helpers";
import { isSpecificError } from "@/errors/errorHelpers";
import { type UUID } from "@/types/stringTypes";

const TIMEOUT_MS = 5000;

export type Payload = JsonValue | void;

const log = process.env.SANDBOX_LOGGING ? console.debug : () => {};

export type RequestPacket = {
  type: string;
  payload?: Payload;
};

type ResponsePacket = { response: Payload } | { error: SerializedError };

export interface PostMessageInfo {
  type: string;
  payload?: Payload;
  recipient: Window;
}

type PostMessageListener = (payload?: Payload) => Promise<Payload | void>;

/**
 * Metadata about a pending message that is waiting for a response from the sandbox. Introduced to assist in
 * debugging issues with sandbox messaging, for use with error telemetry.
 * See https://github.com/pixiebrix/pixiebrix-extension/issues/9150
 */
type PendingMessageMetadata = {
  type: string;
  payloadSize: number;
  timestamp: number;
};

const pendingMessageMetadataMap = new Map<string, PendingMessageMetadata>();

function addPendingMessageMetadata(type: string, payload: Payload): UUID {
  const id = uuidv4();
  const payloadSize = JSON.stringify(payload).length;
  const metadata = { type, payloadSize, timestamp: Date.now() };
  pendingMessageMetadataMap.set(id, metadata);
  return id;
}

function removePendingMessageMetadata(id: UUID) {
  const removedMessage = pendingMessageMetadataMap.get(id);
  pendingMessageMetadataMap.delete(id);
  return removedMessage;
}

export class SandboxTimeoutError extends Error {
  override name = "SandboxTimeoutError";

  constructor(
    message: string,
    public readonly sandboxMessage: PendingMessageMetadata | undefined,
    public readonly pendingSandboxMessages: PendingMessageMetadata[],
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.pendingSandboxMessages = pendingSandboxMessages;
    this.sandboxMessage = sandboxMessage;
  }
}

/** Use the postMessage API but expect a response from the target */
export default async function postMessage<TReturn extends Payload = Payload>({
  type,
  payload,
  recipient,
}: PostMessageInfo): Promise<TReturn> {
  const promise = new Promise<TReturn>((resolve, reject) => {
    const privateChannel = new MessageChannel();
    privateChannel.port1.start(); // Mandatory to start receiving messages
    privateChannel.port1.addEventListener(
      "message",
      ({ data }: MessageEvent<ResponsePacket>): void => {
        if ("error" in data) {
          reject(deserializeError(data.error));
        } else {
          resolve(data.response as TReturn);
        }
      },
      { once: true },
    );

    log("SANDBOX:", type, "Posting payload:", payload);

    const packet: RequestPacket = {
      type,
      payload,
    };

    // The origin must be "*". See note in @file
    recipient.postMessage(packet, "*", [privateChannel.port2]);
  });

  const messageKey = addPendingMessageMetadata(type, payload);
  try {
    const result = await pTimeout(promise, {
      milliseconds: TIMEOUT_MS,
      message: `Message ${type} did not receive a response within ${
        TIMEOUT_MS / 1000
      } seconds`,
    });
    removePendingMessageMetadata(messageKey);
    return result;
  } catch (error) {
    const messageMetadata = removePendingMessageMetadata(messageKey);
    if (isSpecificError(error, TimeoutError)) {
      throw new SandboxTimeoutError(
        error.message,
        messageMetadata,
        [...pendingMessageMetadataMap.values()],
        {
          cause: error,
        },
      );
    }

    throw error;
  }
}

export function addPostMessageListener(
  type: string,
  listener: PostMessageListener,
  { signal }: AbortSignalAsOptions = {},
): void {
  const rawListener = async ({
    data,
    ports: [source],
  }: MessageEvent<RequestPacket>): Promise<void> => {
    if (data?.type !== type) {
      return;
    }

    assertNotNullish(source, "No source port was provided");

    try {
      log("SANDBOX:", type, "Received payload:", data.payload);

      const response = await listener(data.payload);

      log("SANDBOX:", type, "Responding with", response);

      source.postMessage({ response } satisfies ResponsePacket);
    } catch (error) {
      log("SANDBOX:", type, "Throwing", error);

      source.postMessage({
        error: serializeError(error),
      } satisfies ResponsePacket);
    }
  };

  window.addEventListener("message", rawListener, { signal });
}
