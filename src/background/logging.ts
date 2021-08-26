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

import { uuidv4 } from "@/types/helpers";
import { liftBackground } from "@/background/protocol";
import { rollbar } from "@/telemetry/rollbar";
import { MessageContext, Logger as ILogger, SerializedError } from "@/core";
import { Except, JsonObject } from "type-fest";
import { deserializeError, serializeError } from "serialize-error";
import { DBSchema, openDB } from "idb/with-async-ittr";
import { reverse, sortBy, isEmpty } from "lodash";
import { _getDNT } from "@/background/telemetry";
import { isContentScript } from "webext-detect-page";
import { readStorageWithMigration, setStorage } from "@/chrome";
import {
  hasBusinessRootCause,
  hasCancelRootCause,
  isConnectionError,
  getErrorMessage,
} from "@/errors";
import { showConnectionLost } from "@/contentScript/connection";
import { expectBackgroundPage } from "@/utils/expectContext";

const STORAGE_KEY = "LOG";
const ENTRY_OBJECT_STORE = "entries";
const DB_VERSION_NUMBER = 2;

export type MessageLevel = "trace" | "debug" | "info" | "warn" | "error";

export const LOG_LEVELS: { [key in MessageLevel]: number } = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

export interface LogEntry {
  uuid: string;
  timestamp: string;
  message: string;
  level: MessageLevel;
  context: MessageContext;
  data?: JsonObject;
  error?: SerializedError;
}

interface LogDB extends DBSchema {
  [ENTRY_OBJECT_STORE]: {
    value: LogEntry;
    key: string;
    indexes: {
      extensionPointId: string;
      extensionId: string;
      blueprintId: string;
      blockId: string;
      serviceId: string;
      authId: string;
      context: [string, string, string, string, string, string];
    };
  };
}

const indexKeys: Array<
  keyof Except<MessageContext, "deploymentId" | "label">
> = [
  "extensionPointId",
  "extensionId",
  "blueprintId",
  "blockId",
  "serviceId",
  "authId",
];

async function getDB() {
  return openDB<LogDB>(STORAGE_KEY, DB_VERSION_NUMBER, {
    upgrade(db) {
      try {
        // For now, just clear local logs whenever we need to upgrade the log database structure. There's no real use
        // cases for looking at historic local logs
        db.deleteObjectStore(ENTRY_OBJECT_STORE);
        console.warn(
          "Deleting object store %s for upgrade",
          ENTRY_OBJECT_STORE
        );
      } catch {
        // Not sure what will happen if the store doesn't exist (i.e., on initial install, so just NOP it
      }

      // Create a store of objects
      const store = db.createObjectStore(ENTRY_OBJECT_STORE, {
        keyPath: "uuid",
      });
      // Create individual indexes
      for (const indexKey of indexKeys) {
        store.createIndex(indexKey, `context.${indexKey}`, {
          unique: false,
        });
      }

      // Create the joint index
      store.createIndex(
        "context",
        indexKeys.map((x) => `context.${x}`),
        { unique: false }
      );
    },
  });
}

export async function appendEntry(entry: LogEntry): Promise<void> {
  const db = await getDB();
  await db.add(ENTRY_OBJECT_STORE, entry);
}

function makeMatchEntry(
  context: MessageContext = {}
): (entry: LogEntry) => boolean {
  return (entry: LogEntry) =>
    indexKeys.every((key) => {
      // eslint-disable-next-line security/detect-object-injection -- indexKeys is compile-time constant
      const toMatch = context[key];
      // eslint-disable-next-line security/detect-object-injection -- indexKeys is compile-time constant
      return toMatch == null || entry.context?.[key] === toMatch;
    });
}

export async function clearLogs(): Promise<void> {
  const db = await getDB();

  const tx = db.transaction(ENTRY_OBJECT_STORE, "readwrite");
  await tx.store.clear();
}

export async function clearLog(context: MessageContext = {}): Promise<void> {
  const db = await getDB();

  const tx = db.transaction(ENTRY_OBJECT_STORE, "readwrite");

  if (isEmpty(context)) {
    await tx.store.clear();
    return;
  }

  const match = makeMatchEntry(context);
  for await (const cursor of tx.store) {
    if (match(cursor.value)) {
      await cursor.delete();
    }
  }
}

export async function getLog(
  context: MessageContext = {}
): Promise<LogEntry[]> {
  const db = await getDB();
  const tx = db.transaction(ENTRY_OBJECT_STORE, "readonly");
  const match = makeMatchEntry(context);

  const matches = [];
  for await (const cursor of tx.store) {
    if (match(cursor.value)) {
      matches.push(cursor.value);
    }
  }

  // Use both reverse and sortBy because we want insertion order if there's a tie in the timestamp
  return sortBy(reverse(matches), (x) => -Number.parseInt(x.timestamp, 10));
}

function buildContext(
  error: SerializedError,
  context: MessageContext
): MessageContext {
  if (typeof error === "object" && error && error.name === "ContextError") {
    const currentContext =
      typeof error.context === "object" ? error.context : {};
    const innerContext = buildContext(error.cause as SerializedError, context);
    // Prefer the inner context
    return { ...context, ...innerContext, ...currentContext };
  }

  return context;
}

export const recordError = liftBackground(
  "RECORD_ERROR",
  async (
    error: SerializedError,
    context: MessageContext,
    data: JsonObject | undefined
  ): Promise<void> => {
    try {
      const message = getErrorMessage(error);

      if (!(await _getDNT())) {
        // Deserialize the error before passing it to rollbar, otherwise rollbar will assume the object is the custom
        // payload data. WARNING: the prototype chain is lost during deserialization, so make sure any predicate you
        // call here also handles deserialized errors properly.
        // See https://docs.rollbar.com/docs/rollbarjs-configuration-reference#rollbarlog
        // See https://github.com/sindresorhus/serialize-error/issues/48
        const errorObj = deserializeError(error);

        if (hasCancelRootCause(error)) {
          // NOP - no reason to send to Rollbar
        } else if (hasBusinessRootCause(error)) {
          rollbar.debug(message, errorObj);
        } else {
          rollbar.error(message, errorObj);
        }
      }

      await appendEntry({
        uuid: uuidv4(),
        timestamp: Date.now().toString(),
        level: "error",
        context: buildContext(error, context),
        message,
        error,
        data,
      });
    } catch {
      console.error("An error occurred while recording another error", {
        error,
        context,
      });
    }
  },
  { asyncResponse: false }
);

export const recordLog = liftBackground(
  "RECORD_LOG",
  async (
    context: MessageContext,
    level: MessageLevel,
    message: string,
    data: JsonObject
  ): Promise<void> => {
    await appendEntry({
      uuid: uuidv4(),
      timestamp: Date.now().toString(),
      level,
      message,
      data,
      context: context ?? {},
    });
  },
  { asyncResponse: false }
);

export class BackgroundLogger implements ILogger {
  readonly context: MessageContext;

  constructor(context: MessageContext) {
    this.context = context;
  }

  childLogger(context: MessageContext): ILogger {
    return new BackgroundLogger({ ...this.context, ...context });
  }

  async trace(message: string, data: JsonObject): Promise<void> {
    console.trace(message, { data, context: this.context });
    await recordLog(this.context, "trace", message, data);
  }

  async debug(message: string, data: JsonObject): Promise<void> {
    console.debug(message, { data, context: this.context });
    await recordLog(this.context, "debug", message, data);
  }

  async log(message: string, data: JsonObject): Promise<void> {
    console.log(message, { data, context: this.context });
    await recordLog(this.context, "info", message, data);
  }

  async info(message: string, data: JsonObject): Promise<void> {
    console.info(message, { data, context: this.context });
    await recordLog(this.context, "info", message, data);
  }

  async warn(message: string, data: JsonObject): Promise<void> {
    console.warn(message, { data, context: this.context });
    await recordLog(this.context, "warn", message, data);
  }

  async error(error: unknown, data: JsonObject): Promise<void> {
    console.error(`An error occurred: %s`, getErrorMessage(error), {
      error,
      context: this.context,
      data,
    });

    if (isConnectionError(error) && isContentScript()) {
      showConnectionLost();
    }

    await recordError(serializeError(error), this.context, data);
  }
}

export type LoggingConfig = {
  logValues: boolean;
};

const LOG_CONFIG_STORAGE_KEY = "LOG_OPTIONS";
let _config: LoggingConfig = null;

export async function _getLoggingConfig(): Promise<LoggingConfig> {
  expectBackgroundPage();

  if (_config != null) {
    return _config;
  }

  return readStorageWithMigration(LOG_CONFIG_STORAGE_KEY, {});
}

export async function _setLoggingConfig(config: LoggingConfig): Promise<void> {
  expectBackgroundPage();

  await setStorage(LOG_CONFIG_STORAGE_KEY, config);
  _config = config;
}

export const getLoggingConfig = liftBackground("GET_LOGGING_CONFIG", async () =>
  _getLoggingConfig()
);

export const setLoggingConfig = liftBackground(
  "SET_LOGGING_CONFIG",
  async (config: LoggingConfig) => _setLoggingConfig(config)
);
