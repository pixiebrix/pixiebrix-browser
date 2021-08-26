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

import { liftBackground } from "@/background/protocol";
import { JsonObject } from "type-fest";
import { uuidv4 } from "@/types/helpers";
import { compact, debounce, throttle, uniq } from "lodash";
import { browser } from "webextension-polyfill-ts";
import { readStorage, setStorage } from "@/chrome";
import { isLinked } from "@/auth/token";
import { Data } from "@/core";
import { boolean } from "@/utils";
import { loadOptions } from "@/options/loader";
import { getLinkedApiClient } from "@/services/apiClient";

const EVENT_BUFFER_DEBOUNCE_MS = 2000;
const EVENT_BUFFER_MAX_MS = 10_000;

interface UserEvent {
  uid: string;
  event: string;
  timestamp: number;
  data: JsonObject;
}

export const DNT_STORAGE_KEY = "DNT";
const UUID_STORAGE_KEY = "USER_UUID";

let _uid: string = null;
let _dnt: boolean;
const buffer: UserEvent[] = [];

/**
 * Return a random ID for this browser profile.
 */
async function uid(): Promise<string> {
  if (_uid != null) {
    return _uid;
  }

  let uuid = await readStorage<boolean | string>(UUID_STORAGE_KEY);
  if (!uuid || typeof uuid !== "string") {
    uuid = uuidv4();
    await setStorage(UUID_STORAGE_KEY, uuid);
  }

  _uid = uuid;
  return _uid;
}

export async function _toggleDNT(enable: boolean): Promise<boolean> {
  _dnt = enable;
  await setStorage(DNT_STORAGE_KEY, enable);
  return enable;
}

export async function _getDNT(): Promise<boolean> {
  if (_dnt != null) {
    return _dnt;
  }

  _dnt = boolean(
    (await readStorage<boolean | string>(DNT_STORAGE_KEY)) ?? process.env.DEBUG
  );
  return _dnt;
}

async function flush(): Promise<void> {
  if (buffer.length > 0) {
    const events = buffer.splice(0, buffer.length);
    await (await getLinkedApiClient()).post("/api/events/", { events });
  }
}

const debouncedFlush = debounce(flush, EVENT_BUFFER_DEBOUNCE_MS, {
  trailing: true,
  leading: false,
  maxWait: EVENT_BUFFER_MAX_MS,
});

export const getDNT = liftBackground("GET_DNT", async () => _getDNT());

export const getUID = liftBackground("GET_UID", async () => uid());

export const getExtensionVersion = liftBackground(
  "GET_EXTENSION_VERSION",
  async () => browser.runtime.getManifest().version
);

export const toggleDNT = liftBackground(
  "TOGGLE_DNT",
  async (enabled: boolean) => _toggleDNT(enabled)
);

async function userSummary() {
  const { os } = await browser.runtime.getPlatformInfo();
  // Getting browser information would require additional permissions
  // const {name: browserName} = await browser.runtime.getBrowserInfo();
  let numActiveExtensions: number = null;
  let numActiveExtensionPoints: number = null;
  let numActiveBlueprints: number = null;

  try {
    const { extensions } = await loadOptions();
    numActiveExtensions = extensions.length;
    numActiveBlueprints = uniq(compact(extensions.map((x) => x._recipe?.id)))
      .length;
    numActiveExtensionPoints = uniq(extensions.map((x) => x.extensionPointId))
      .length;
  } catch (error: unknown) {
    console.warn("Cannot get number of extensions", { error });
  }

  return {
    numActiveExtensions,
    numActiveBlueprints,
    numActiveExtensionPoints,
    $os: os,
  };
}

async function _init(): Promise<void> {
  if (await isLinked()) {
    await (await getLinkedApiClient()).post("/api/identify/", {
      uid: await uid(),
      data: await userSummary(),
    });
  }
}

// Up to every 30 min
const throttledInit = throttle(_init, 30 * 60 * 1000, {
  leading: true,
  trailing: true,
});

export const initUID = liftBackground(
  "INIT_UID",
  async (): Promise<void> => {
    if (!(await _getDNT())) {
      void throttledInit();
    }
  },
  { asyncResponse: false }
);

export const recordEvent = liftBackground(
  "RECORD_EVENT",
  async ({
    event,
    data = {},
  }: {
    event: string;
    data: JsonObject | undefined;
  }): Promise<void> => {
    if (!(await _getDNT())) {
      buffer.push({
        uid: await uid(),
        event,
        timestamp: Date.now(),
        data,
      });
      void debouncedFlush();
    }
  },
  { asyncResponse: false }
);

export const sendDeploymentAlert = liftBackground(
  "SEND_DEPLOYMENT_ALERT",
  async ({ deploymentId, data }: { deploymentId: string; data: Data }) => {
    const url = `/api/deployments/${deploymentId}/alerts/`;
    await (await getLinkedApiClient()).post(url, data);
  }
);
