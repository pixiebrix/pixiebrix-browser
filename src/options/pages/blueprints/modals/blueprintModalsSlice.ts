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

import { type MessageContext, type RegistryId, type UUID } from "@/core";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type LogsContext = {
  title: string;
  messageContext: MessageContext;
};

export type ShareContext = {
  blueprintId?: RegistryId;
  extensionId?: UUID;
};

export type BlueprintModalsState = {
  showLogsContext: LogsContext;
  showShareContext: ShareContext;
};

const initialState: BlueprintModalsState = {
  showLogsContext: null,
  showShareContext: null,
};

export const blueprintModalsSlice = createSlice({
  name: "blueprintModals",
  initialState,
  reducers: {
    setLogsContext(state, action: PayloadAction<LogsContext>) {
      state.showLogsContext = action.payload;
      state.showShareContext = null;
    },
    setShareContext(state, action: PayloadAction<ShareContext | null>) {
      state.showShareContext = action.payload;
      state.showLogsContext = null;
    },
  },
});
