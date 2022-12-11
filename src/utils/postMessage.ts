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

import { type SerializedError, type UUID } from "@/core";
import { uuidv4 } from "@/types/helpers";
import pDefer from "p-defer";
import pTimeout from "p-timeout";
import { deserializeError, serializeError } from "serialize-error";
import { type JsonValue, type RequireExactlyOne } from "type-fest";

const TIMEOUT_MS = 3000;

type Payload = JsonValue;

type PixiebrixPacket = RequireExactlyOne<
  {
    type: string;
    payload: Payload;
    error: SerializedError;
    nonce: UUID;
  },
  "payload" | "error"
>;

interface PostMessageInfo {
  type: string;
  payload?: Payload;
  channel: Window;
}

type PostMessageListener = (payload: Payload) => Promise<Payload>;

/** Use the postMessage API but expect a response from the target */
export default async function postMessage({
  type,
  payload,
  channel,
}: PostMessageInfo): Promise<Payload> {
  const packet: PixiebrixPacket = {
    type,
    payload,
    nonce: uuidv4(),
  };
  const { promise, resolve, reject } = pDefer<Payload>();
  const controller = new AbortController();

  const listener = ({ origin, data }: MessageEvent<PixiebrixPacket>): void => {
    if (origin === "null" && data?.nonce === packet.nonce) {
      if (data.error) {
        reject(deserializeError(data.error));
      } else {
        resolve(data.payload);
      }
    }
  };

  window.addEventListener("message", listener, { signal: controller.signal });

  // The origin must be "*" because it's reported as "null" to the outside world.
  // This is fine because the host page does not receive these messages, they're only
  // sent to the iframe, which is wrapped in a closed shadow DOM.
  // https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#using_window.postmessage_in_extensions_non-standard

  console.debug("SANDBOX: Posting", type, "with payload:", payload);
  channel.postMessage(packet, "*");

  try {
    return await pTimeout(promise, {
      milliseconds: TIMEOUT_MS,
      message: `Message ${type} did not receive a response within ${
        TIMEOUT_MS / 1000
      } seconds`,
    });
  } finally {
    controller.abort();
  }
}

export function addPostMessageListener(
  type: string,
  listener: PostMessageListener,
  { signal }: { signal?: AbortSignal } = {}
): void {
  const rawListener = async ({
    data,
    source,
    origin,
  }: MessageEvent<PixiebrixPacket>): Promise<void> => {
    if (data?.type !== type) {
      return;
    }

    console.debug("SANDBOX: Received", type, "payload:", data.payload);

    const [response] = await Promise.allSettled([listener(data.payload)]);

    console.debug("SANDBOX: Responding to", type, "with", response);

    const packet: PixiebrixPacket = {
      type,
      nonce: data.nonce,
      ...("reason" in response
        ? { error: serializeError(response.reason) }
        : { payload: response.value }),
    };

    source.postMessage(packet, { targetOrigin: origin });
  };

  window.addEventListener("message", rawListener, { signal });
}
