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

import { SidebarEntries, FormEntry, PanelEntry } from "@/sidebar/types";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { defaultEventKey, mapTabEventKey } from "@/sidebar/utils";
import { UUID } from "@/core";
import { cancelForm } from "@/contentScript/messenger/api";
import { whoAmI } from "@/background/messenger/api";
import { asyncForEach } from "@/utils";

export type SidebarState = SidebarEntries & {
  activeKey: string;
};

export const emptySidebarState: SidebarState = {
  panels: [],
  forms: [],
  activeKey: null,
};

const sidebarSlice = createSlice({
  initialState: emptySidebarState,
  name: "sidebar",
  reducers: {
    selectTab(state, action: PayloadAction<string>) {
      state.activeKey = action.payload;
    },
    addForm(state, action: PayloadAction<{ form: FormEntry }>) {
      const { form } = action.payload;

      // Cancel pre-existing forms for the extension
      void asyncForEach(state.forms, async (current) => {
        if (current.extensionId === form.extensionId) {
          const sender = await whoAmI();
          await cancelForm({ tabId: sender.tab.id, frameId: 0 }, current.nonce);
        }
      });

      state.forms = state.forms.filter(
        (x) => x.extensionId !== form.extensionId
      );
      state.forms.push(form);
      state.activeKey = mapTabEventKey("form", form);
    },
    removeForm(state, action: PayloadAction<UUID>) {
      const nonce = action.payload;
      state.forms = state.forms.filter((x) => x.nonce !== nonce);
      state.activeKey = defaultEventKey(state);
    },
    setPanels(state, action: PayloadAction<{ panels: PanelEntry[] }>) {
      state.panels = action.payload.panels;
      // If a panel is no longer available, reset the current tab to a valid tab
      if (
        state.activeKey == null ||
        (state.activeKey.startsWith("panel-") &&
          !state.panels.some(
            (x) => mapTabEventKey("panel", x) === state.activeKey
          ))
      ) {
        state.activeKey = defaultEventKey(state);
      }
    },
  },
});

export default sidebarSlice;
