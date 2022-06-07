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

import reportError from "@/telemetry/reportError";
import { ActivatePanelOptions, FormEntry, PanelEntry } from "@/sidebar/types";
import { FormDefinition } from "@/blocks/transformers/ephemeralForm/formTypes";
import { UUID } from "@/core";

let lastMessageSeen = -1;
// Track activate messages separately. The Sidebar App Redux state has special handling for these messages to account
// for race conditions in panel loading
let lastActivateMessageSeen = -1;

export type SidebarListener = {
  onRenderPanels: (panels: PanelEntry[]) => void;
  onShowForm: (form: { nonce: UUID; form: FormDefinition }) => void;
  onHideForm: (form: { nonce: UUID }) => void;
  onActivatePanel: (options: ActivatePanelOptions) => void;
};

const listeners: SidebarListener[] = [];

export function addListener(fn: SidebarListener): void {
  if (listeners.includes(fn)) {
    console.warn("Listener already registered for sidebar");
  } else {
    listeners.push(fn);
  }
}

export function removeListener(fn: SidebarListener): void {
  listeners.splice(0, listeners.length, ...listeners.filter((x) => x !== fn));
}

function runListeners<Method extends keyof SidebarListener>(
  method: Method,
  sequence: number,
  data: Parameters<SidebarListener[Method]>[0],
  { force = false }: { force?: boolean } = {}
): void {
  if (sequence < lastMessageSeen && !force) {
    console.debug(
      "Skipping stale message (seq: %d, current: %d)",
      sequence,
      lastMessageSeen,
      { data }
    );
    return;
  }

  // Use Match.max to account for unordered messages with force
  lastMessageSeen = Math.max(sequence, lastMessageSeen);

  console.debug(`Running ${listeners.length} listener(s) for %s`, method, {
    data,
  });

  for (const listener of listeners) {
    try {
      // @ts-expect-error `data` is a intersection type instead of an union. TODO: Fix or rewrite
      // eslint-disable-next-line security/detect-object-injection -- method is keyof StoreListener
      listener[method](data);
    } catch (error) {
      reportError(error);
    }
  }
}

export async function renderPanels(
  sequence: number,
  panels: PanelEntry[]
): Promise<void> {
  runListeners("onRenderPanels", sequence, panels);
}

export async function activatePanel(
  sequence: number,
  options: ActivatePanelOptions
): Promise<void> {
  if (sequence < lastActivateMessageSeen) {
    console.debug(
      "Skipping stale message (seq: %d, current: %d)",
      sequence,
      lastActivateMessageSeen,
      { data: options }
    );
    return;
  }

  lastActivateMessageSeen = sequence;

  runListeners("onActivatePanel", sequence, options, { force: true });
}

export async function showForm(sequence: number, entry: FormEntry) {
  runListeners("onShowForm", sequence, entry);
}

export async function hideForm(sequence: number, nonce: UUID) {
  runListeners("onHideForm", sequence, { nonce });
}
