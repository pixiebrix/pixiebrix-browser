/*
 * Copyright (C) 2023 PixieBrix, Inc.
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
import {
  type ActivatePanelOptions,
  type ModActivationPanelEntry,
  type FormPanelEntry,
  type PanelEntry,
  type TemporaryPanelEntry,
} from "@/types/sidebarTypes";
import { type FormDefinition } from "@/bricks/transformers/ephemeralForm/formTypes";
import { type UUID } from "@/types/stringTypes";
import { sortBy } from "lodash";

let lastMessageSeen = -1;
// Track activate messages separately. The Sidebar App Redux state has special handling for these messages to account
// for race conditions in panel loading
let lastActivateMessageSeen = -1;

export type SidebarListener = {
  onRenderPanels: (panels: PanelEntry[]) => void;
  onShowForm: (form: { nonce: UUID; form: FormDefinition }) => void;
  onHideForm: (form: { nonce: UUID }) => void;
  onActivatePanel: (options: ActivatePanelOptions) => void;
  /**
   * Update an existing temporary panel, or NOP if the panel nonce doesn't exist.
   * @param panel the updated panel entry
   */
  onUpdateTemporaryPanel: (panel: TemporaryPanelEntry) => void;
  /**
   * Show a panel, and cancel any existing temporary panel for the same extension.
   * @param panel the new panel entry
   */
  onShowTemporaryPanel: (panel: TemporaryPanelEntry) => void;
  onHideTemporaryPanel: (panel: { nonce: UUID }) => void;
  onShowActivateRecipe: (activateRecipeEntry: ModActivationPanelEntry) => void;
  onHideActivateRecipe: () => void;
};

// Because protocol.tsx accepts webext-messenger messages before the React App and listener initializes, we have to
// keep track messages sent in the interim. This buffer is flushed once the listener is initialized.
const messageBuffer: Array<{
  method: keyof SidebarListener;
  sequence: number;
  data: unknown;
}> = [];

const listeners: SidebarListener[] = [];

/**
 * Add a listener.
 *
 * If this is only listener, any buffered messages from webext-messenger will be flushed to the listener. This is to
 * account for races between webext-messenger and React App initialization.
 *
 * @param listener the listener to add
 */
export function addListener(listener: SidebarListener): void {
  if (listeners.includes(listener)) {
    console.warn("Listener already registered for sidebar");
    return;
  }

  listeners.push(listener);

  if (listeners.length === 1) {
    // First listener was added
    flushMessageBuffer();
  }
}

export function removeListener(listener: SidebarListener): void {
  listeners.splice(
    0,
    listeners.length,
    ...listeners.filter((x) => x !== listener)
  );
}

/**
 * Flush the message buffer to the listener and clear the buffer.
 */
function flushMessageBuffer(): void {
  if (listeners.length === 0) {
    throw new Error("Expected one or more listeners");
  }

  // `sortBy` to handle case where messages were received out of order
  const orderedMessageBuffer = sortBy(messageBuffer, "sequence");
  messageBuffer.splice(0, messageBuffer.length);

  for (const { method, sequence, data } of orderedMessageBuffer) {
    console.debug("flushMessageBuffer: %s", method, {
      sequence,
      data,
    });

    runListeners(method, sequence, data);
  }
}

function runListeners<Method extends keyof SidebarListener>(
  method: Method,
  sequence: number,
  data: Parameters<SidebarListener[Method]>[0],
  { force = false }: { force?: boolean } = {}
): void {
  // Buffer messages until the listener is initialized
  if (listeners.length === 0) {
    messageBuffer.push({ method, sequence, data });
    return;
  }

  if (sequence < lastMessageSeen && !force) {
    console.debug(
      "Skipping stale message (seq: %d, current: %d)",
      sequence,
      lastMessageSeen,
      { data }
    );
    return;
  }

  // Use Math.max to account for unordered messages with force
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

export async function showForm(sequence: number, entry: FormPanelEntry) {
  runListeners("onShowForm", sequence, entry);
}

export async function hideForm(sequence: number, nonce: UUID) {
  runListeners("onHideForm", sequence, { nonce });
}

export async function showTemporaryPanel(
  sequence: number,
  entry: TemporaryPanelEntry
) {
  runListeners("onShowTemporaryPanel", sequence, entry);
}

export async function updateTemporaryPanel(
  sequence: number,
  entry: TemporaryPanelEntry
) {
  runListeners("onUpdateTemporaryPanel", sequence, entry);
}

export async function hideTemporaryPanel(sequence: number, nonce: UUID) {
  runListeners("onHideTemporaryPanel", sequence, { nonce });
}

export async function showActivateMods(
  sequence: number,
  entry: ModActivationPanelEntry
): Promise<void> {
  runListeners("onShowActivateRecipe", sequence, entry);
}

export async function hideActivateMods(sequence: number): Promise<void> {
  runListeners("onHideActivateRecipe", sequence, null);
}
