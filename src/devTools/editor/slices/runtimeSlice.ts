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

import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { UUID } from "@/core";
import { TraceRecord } from "@/telemetry/trace";

export type RuntimeState = {
  /**
   * Mapping from extension id to its latest available trace.
   */
  extensionTraces: Record<UUID, TraceRecord[]>;
};

const initialState: RuntimeState = {
  extensionTraces: {},
};

export function selectRunId(records: TraceRecord[]): UUID {
  return (records ?? [])[0]?.runId;
}

const runtimeSlice = createSlice({
  name: "runtime",
  initialState,
  reducers: {
    setExtensionTrace(
      state,
      { payload }: PayloadAction<{ extensionId: UUID; records: TraceRecord[] }>
    ) {
      const { extensionId, records } = payload;

      // @ts-expect-error -- why does this cause infinite typing issues? Probably related to partial over sum type
      const previousRunId = selectRunId(state.extensionTraces[extensionId]);
      const currentRunId = selectRunId(records);

      if (previousRunId !== currentRunId) {
        state.extensionTraces[extensionId] = records;
      }
    },
  },
});

export default runtimeSlice;
