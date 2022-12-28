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

import pDefer from "p-defer";
import { injectContentScript } from "webext-content-scripts";
import { getAdditionalPermissions } from "webext-additional-permissions";
import { patternToRegex } from "webext-patterns";
import { ENSURE_CONTENT_SCRIPT_READY } from "@/messaging/constants";
import { isRemoteProcedureCallRequest } from "@/messaging/protocol";
import { expectContext } from "@/utils/expectContext";
import pTimeout from "p-timeout";
import type { Target } from "@/types";
import { getTargetState } from "@/contentScript/ready";
import { memoizeUntilSettled } from "@/utils";

/** Checks whether a URL will have the content scripts automatically injected */
export async function isContentScriptRegistered(url: string): Promise<boolean> {
  // Injected by the browser
  const manifestScriptsOrigins = browser.runtime
    .getManifest()
    .content_scripts.flatMap((script) => script.matches);

  // Injected by `webext-dynamic-content-scripts`
  const { origins } = await getAdditionalPermissions({
    strictOrigins: false,
  });

  // Do not replace the 2 calls above with `permissions.getAll` because it might also
  // include hosts that are permitted by the manifest but have no content script registered.
  return patternToRegex(...origins, ...manifestScriptsOrigins).test(url);
}

export async function onReadyNotification(signal: AbortSignal): Promise<void> {
  const { resolve, promise: readyNotification } = pDefer();

  const onMessage = (message: unknown) => {
    if (
      isRemoteProcedureCallRequest(message) &&
      message.type === ENSURE_CONTENT_SCRIPT_READY
    ) {
      resolve();
    }
  };

  // `onReadyNotification` is not expected to throw. It resolves on `abort` simply to
  // clean up the listeners, but by then nothing is awaiting this promise anyway.
  browser.runtime.onMessage.addListener(onMessage);
  signal.addEventListener("abort", resolve);

  try {
    await readyNotification;
  } finally {
    browser.runtime.onMessage.removeListener(onMessage);
    signal.removeEventListener("abort", resolve);
  }
}

/**
 * Ensures that the contentScript is ready on the specified page, regardless of its status.
 * - If it's not expected to be injected automatically, it also injects it into the page.
 * - If it's been injected, it will resolve once the content script is ready.
 */
export const ensureContentScript = memoizeUntilSettled(
  async (target: Target, timeoutMillis = 4000): Promise<void> => {
    expectContext("background");

    const controller = new AbortController();
    const { signal } = controller;

    try {
      console.debug("ensureContentScript: requested", target);

      // TODO: Simplify after https://github.com/sindresorhus/p-timeout/issues/31
      await pTimeout(ensureContentScriptWithoutTimeout(target, signal), {
        signal,
        milliseconds: timeoutMillis,
        message: `contentScript not ready in ${timeoutMillis}ms`,
      });

      console.debug("ensureContentScript: ready", target);
    } finally {
      controller.abort();
    }
  },
  { cacheKey: JSON.stringify }
);

async function ensureContentScriptWithoutTimeout(
  target: Target,
  signal: AbortSignal
): Promise<void> {
  // Start waiting for the notification as early as possible,
  // `webext-dynamic-content-scripts` might have already injected the content script
  const readyNotificationPromise = onReadyNotification(signal);

  const result = await getTargetState(target); // It will throw if we don't have permissions

  if (result.ready) {
    console.debug("ensureContentScript: already exists and is ready", target);
    return;
  }

  if (result.installed) {
    console.debug(
      "ensureContentScript: already exists but isn't ready",
      target
    );

    await readyNotificationPromise;
    return;
  }

  if (await isContentScriptRegistered(result.url)) {
    // TODO: Potentially inject anyway on pixiebrix.com https://github.com/pixiebrix/pixiebrix-extension/issues/4189
    console.debug(
      "ensureContentScript: will be injected automatically by the manifest or webext-dynamic-content-script",
      target
    );

    await readyNotificationPromise;
    return;
  }

  console.debug("ensureContentScript: injecting", target);
  const scripts = browser.runtime
    .getManifest()
    .content_scripts.map((script) => {
      script.all_frames = false;
      return script;
    });

  await injectContentScript(target, scripts);
  await readyNotificationPromise;
}
