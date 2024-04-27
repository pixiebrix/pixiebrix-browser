/*
 * Copyright (C) 2024 PixieBrix, Inc.
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

import { cancelForm } from "@/contentScript/messenger/strict/api";
import { getConnectedTarget } from "@/sidebar/connectedTarget";
import { type SidebarState } from "@/types/sidebarTypes";
import { type UUID } from "@/types/stringTypes";
import { createAsyncThunk } from "@reduxjs/toolkit";
import { partition } from "lodash";

type RemoveFormPanelReturn =
  | {
      removedEntry: SidebarState["forms"][number];
      forms: SidebarState["forms"];
    }
  | undefined;

const removeFormPanel = createAsyncThunk<
  RemoveFormPanelReturn,
  UUID,
  { state: { sidebar: SidebarState } }
>("sidebar/removeFormPanel", async (nonce, { getState }) => {
  const { forms } = getState().sidebar;

  const [[removedEntry], otherFormPanels] = partition(
    forms,
    (panel) => panel.nonce === nonce,
  );

  if (!removedEntry) {
    return;
  }

  // Trigger form close for the mod only if it's not already unavailable,
  // since forms won't exist on the form controller after the page navigation
  if (!removedEntry.isUnavailable) {
    await closeForms([nonce]);
  }

  return {
    removedEntry,
    forms: otherFormPanels,
  };
});

/**
 * Close form panels
 * @param nonces panel nonces
 */
async function closeForms(nonces: UUID[]): Promise<void> {
  const topLevelFrame = await getConnectedTarget();
  cancelForm(topLevelFrame, ...nonces);
}

export default removeFormPanel;
