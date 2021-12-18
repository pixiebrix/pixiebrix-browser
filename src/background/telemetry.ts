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
import browser from "webextension-polyfill";
import { ManualStorageKey, readStorage, setStorage } from "@/chrome";
import { isLinked } from "@/auth/token";
import { Data, UUID } from "@/core";
import { loadOptions } from "@/options/loader";
import {
  getLinkedApiClient,
  maybeGetLinkedApiClient,
} from "@/services/apiClient";
import { getDNT } from "@/telemetry/dnt";

const EVENT_BUFFER_DEBOUNCE_MS = 2000;
const EVENT_BUFFER_MAX_MS = 10_000;

interface UserEvent {
  uid: string;
  event: string;
  timestamp: number;
  data: JsonObject;
}

const UUID_STORAGE_KEY = "USER_UUID" as ManualStorageKey;

let _uid: UUID = null;
const buffer: UserEvent[] = [];

/**
 * Return a random ID for this browser profile.
 */
async function uid(): Promise<UUID> {
  if (_uid != null) {
    return _uid;
  }

  let uuid = await readStorage<UUID>(UUID_STORAGE_KEY);

  console.debug("Current browser UID", { uuid });

  if (!uuid || typeof uuid !== "string") {
    uuid = uuidv4();
    console.debug("Generating UID for browser", { uuid });
    await setStorage(UUID_STORAGE_KEY, uuid);
  }

  _uid = uuid;
  return _uid;
}

async function flush(): Promise<void> {
  if (buffer.length > 0) {
    const client = await maybeGetLinkedApiClient();
    if (client) {
      const events = buffer.splice(0, buffer.length);
      await client.post("/api/events/", { events });
    }
  }
}

const debouncedFlush = debounce(flush, EVENT_BUFFER_DEBOUNCE_MS, {
  trailing: true,
  leading: false,
  maxWait: EVENT_BUFFER_MAX_MS,
});

export const getUID = liftBackground("GET_UID", async () => uid());

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
  } catch (error) {
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
    if (!(await getDNT())) {
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
    if (!(await getDNT())) {
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
