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

import { createSlice } from "@reduxjs/toolkit";
import { type UUID } from "@/core";
import { uuidv4 } from "@/types/helpers";

export type SessionState = {
  sessionId: UUID;
  /**
   * The session start in milliseconds from epoch
   */
  sessionStart: number;
};

export type SessionRootState = {
  session: SessionState;
};

const initialState: SessionState = {
  sessionId: uuidv4(),
  sessionStart: Date.now(),
};

const runtimeSlice = createSlice({
  name: "session",
  initialState,
  reducers: {},
});

export default runtimeSlice;
