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

import {
  SidebarEntries,
  FormEntry,
  PanelEntry,
  ActivatePanelOptions,
} from "@/sidebar/types";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { defaultEventKey, mapTabEventKey } from "@/sidebar/utils";
import { UUID } from "@/core";
import { cancelForm } from "@/contentScript/messenger/api";
import { whoAmI } from "@/background/messenger/api";
import { asyncForEach } from "@/utils";
import { sortBy } from "lodash";

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
      // Unlike panels which are sorted, forms are like a "stack", will show the latest form available
      state.forms.push(form);
      state.activeKey = mapTabEventKey("form", form);
    },
    removeForm(state, action: PayloadAction<UUID>) {
      const nonce = action.payload;
      state.forms = state.forms.filter((x) => x.nonce !== nonce);
      state.activeKey = defaultEventKey(state);
    },
    activatePanel(
      state,
      {
        payload: { extensionId, panelHeading, blueprintId, force },
      }: PayloadAction<ActivatePanelOptions>
    ) {
      const hasActive = state.forms.length > 0 || state.panels.length > 0;

      if (hasActive && !force) {
        return;
      }

      // Try matching on extension
      if (extensionId) {
        const extensionForm = state.forms.find(
          (x) => x.extensionId === extensionId
        );
        if (extensionForm) {
          state.activeKey = mapTabEventKey("form", extensionForm);
          return;
        }

        const extensionPanel = state.panels.find(
          (x) => x.extensionId === extensionId
        );
        if (extensionPanel) {
          state.activeKey = mapTabEventKey("panel", extensionPanel);
        }
      }

      // Try matching on panel heading
      if (panelHeading) {
        const extensionPanel = state.panels
          .filter((x) => blueprintId == null || x.blueprintId === blueprintId)
          .find((x) => x.heading === panelHeading);
        if (extensionPanel) {
          state.activeKey = mapTabEventKey("panel", extensionPanel);
        }
      }

      // Try matching on blueprint
      if (blueprintId) {
        const blueprintPanel = state.panels.find(
          (x) => x.blueprintId === blueprintId
        );
        if (blueprintPanel) {
          state.activeKey = mapTabEventKey("panel", blueprintPanel);
        }
      }
    },
    setPanels(state, action: PayloadAction<{ panels: PanelEntry[] }>) {
      // For now, pick an arbitrary order that's stable. There's no guarantees on which order panels are registered
      state.panels = sortBy(
        action.payload.panels,
        (panel) => panel.extensionId
      );

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
