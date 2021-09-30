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

import { RegistryId, RenderedArgs, UUID } from "@/core";
import { JsonObject } from "type-fest";
import { DBSchema, openDB } from "idb/with-async-ittr";
import { sortBy } from "lodash";

const STORAGE_KEY = "TRACE";
const ENTRY_OBJECT_STORE = "traces";
const DB_VERSION_NUMBER = 1;

export type TraceRecordMeta = {
  /**
   * Extension id, to correlate across extension runs.
   *
   * `null` for ad-hoc block execution.
   */
  extensionId: UUID | null;

  /**
   * Unique run id to correlate trace elements from the same run.
   */
  runId: UUID;

  /**
   * Unique id to identify the block across runs.
   */
  blockInstanceId: UUID;

  /**
   * The registry id of the block.
   */
  blockId: RegistryId;
};

type Output = {
  outputKey: string | null;

  /**
   * Output of the block
   */
  output: JsonObject | null;
};

type ErrorOutput = {
  /**
   * Serialized error from running the block
   */
  error: JsonObject;
};

/**
 *
 */
export type TraceEntryData = TraceRecordMeta & {
  /**
   * ISO timestamp when the trace element was recorded.
   */
  timestamp: string;

  templateContext: JsonObject;

  renderedArgs: RenderedArgs;
};

export type TraceExitData = TraceRecordMeta & (Output | ErrorOutput);

export type TraceRecord = TraceEntryData & Partial<TraceExitData>;

export type TraceSuccess = TraceEntryData & Output;
export type TraceError = TraceEntryData & ErrorOutput;

const indexKeys: Array<
  keyof Pick<TraceRecordMeta, "runId" | "blockInstanceId" | "extensionId">
> = ["runId", "blockInstanceId", "extensionId"];

interface TraceDB extends DBSchema {
  [ENTRY_OBJECT_STORE]: {
    value: TraceRecord;
    key: string;
    indexes: {
      runId: UUID;
      blockInstanceId: UUID;
      extensionId: UUID;
    };
  };
}

async function getDB() {
  return openDB<TraceDB>(STORAGE_KEY, DB_VERSION_NUMBER, {
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
        // Not sure what will happen if the store doesn't exist (i.e., on initial install, so just NOP it)
      }

      // Create a store of objects
      const store = db.createObjectStore(ENTRY_OBJECT_STORE, {
        keyPath: ["runId", "blockInstanceId"],
      });

      // Create individual indexes
      for (const indexKey of indexKeys) {
        store.createIndex(indexKey, indexKey, {
          unique: false,
        });
      }
    },
  });
}

export async function addTraceEntry(record: TraceEntryData): Promise<void> {
  if (!record.runId) {
    console.debug("Ignoring trace entry data without runId");
    return;
  }

  if (!record.blockInstanceId) {
    console.debug("Ignoring trace entry data without blockInstanceId");
    return;
  }

  const db = await getDB();
  await db.add(ENTRY_OBJECT_STORE, record);
}

export async function addTraceExit(record: TraceExitData): Promise<void> {
  if (!record.runId) {
    console.debug("Ignoring trace exit data without runId");
    return;
  }

  if (!record.blockInstanceId) {
    console.debug("Ignoring trace exit data without blockInstanceId");
    return;
  }

  const db = await getDB();

  const tx = db.transaction(ENTRY_OBJECT_STORE, "readwrite");

  const data = await tx.store.get([
    record.runId,
    record.blockInstanceId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- types are wrong in idb?
  ] as any);

  await tx.store.put({
    ...data,
    ...record,
  });
}

export async function clearTraces(): Promise<void> {
  const db = await getDB();

  const tx = db.transaction(ENTRY_OBJECT_STORE, "readwrite");
  await tx.store.clear();
}

export async function clearExtensionTraces(extensionId: UUID): Promise<void> {
  let cnt = 0;

  const db = await getDB();

  const tx = db.transaction(ENTRY_OBJECT_STORE, "readwrite");

  // There's probably a better way to write this using the index
  for await (const cursor of tx.store) {
    if (cursor.value.extensionId === extensionId) {
      cnt++;
      await cursor.delete();
    }
  }

  console.debug("Cleared %d trace entries for extension %s", cnt, extensionId);
}

export async function getLatestRunByExtensionId(
  extensionId: UUID
): Promise<TraceRecord[]> {
  const db = await getDB();
  const tx = db.transaction(ENTRY_OBJECT_STORE, "readonly");

  const matches = [];
  for await (const cursor of tx.store) {
    if (cursor.value.extensionId === extensionId) {
      matches.push(cursor.value);
    }
  }

  // Use both reverse and sortBy because we want insertion order if there's a tie in the timestamp
  const sorted = sortBy(
    matches.reverse(),
    (x) => -new Date(x.timestamp).getTime()
  );

  if (sorted.length > 0) {
    const { runId } = sorted[0];
    return sorted.filter((x) => x.runId === runId);
  }

  return [];
}

export async function getByInstanceId(
  blockInstanceId: UUID
): Promise<TraceRecord[]> {
  const db = await getDB();
  const tx = db.transaction(ENTRY_OBJECT_STORE, "readonly");

  const matches = [];
  for await (const cursor of tx.store) {
    if (cursor.value.blockInstanceId === blockInstanceId) {
      matches.push(cursor.value);
    }
  }

  // Use both reverse and sortBy because we want insertion order if there's a tie in the timestamp
  return sortBy(matches.reverse(), (x) => -new Date(x.timestamp).getTime());

  // TODO: figure out how to write an indexed query
  // return tx.store
  //   .index("blockInstanceId")
  //   .getAll(IDBKeyRange.only(blockInstanceId));
}
