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

import { type UUID } from "@/types/stringTypes";
import pDefer, { type DeferredPromise } from "p-defer";
import { expectContext } from "@/utils/expectContext";
import {
  type PanelAction,
  type TemporaryPanelEntry,
} from "@/types/sidebarTypes";
import { ClosePanelAction } from "@/blocks/errors";
import { CancelError } from "@/errors/businessErrors";
import { type Except } from "type-fest";
import { type Location } from "@/types/extensionPointTypes";

export type RegisteredPanel = {
  /**
   * The location of the panel. Used to determine which registered temporary panels to reserve space for in the
   * sidebar when the sidebar opens.
   */
  location: Location;
  /**
   * The id of the extension that owns the panel.
   *
   * Should match RegisteredPanel.entry.extensionId if entry is defined.
   */
  extensionId: UUID;
  /**
   * The deferred promise that will be resolved when the panel is submitted/closed
   */
  registration: DeferredPromise<PanelAction | null>;
  /**
   * The panel entry, or undefined for placeholder panels
   */
  entry?: Except<TemporaryPanelEntry, "type">;
};

const panels = new Map<UUID, RegisteredPanel>();

// Mapping from extensionId to active panel nonces
const extensionNonces = new Map<UUID, Set<UUID>>();

/**
 * Return all temporary panel entries.
 */
export function getTemporaryPanelSidebarEntries(): TemporaryPanelEntry[] {
  expectContext("contentScript");

  return [...panels.entries()]
    .filter(([, panel]) => panel.location === "panel")
    .map(([nonce, panel]) => ({
      type: "temporaryPanel",
      extensionId: panel.extensionId,
      nonce,
      ...panel.entry,
    }));
}

/**
 * Get panel definition, or error if panel is not defined for nonce.
 * @param nonce the panel nonce
 */
export async function getPanelDefinition(
  nonce: UUID
): Promise<TemporaryPanelEntry> {
  expectContext("contentScript");

  const panel = panels.get(nonce);

  if (!panel) {
    throw new Error("Panel definition not found");
  }

  return { type: "temporaryPanel", ...panel.entry };
}

/**
 * Update a panel definition. NOTE: the caller is responsible for notifying the container to refetch the
 * panel definition.
 * @param entry the panel definition
 */
export function updatePanelDefinition(
  entry: Except<TemporaryPanelEntry, "type">
): void {
  expectContext("contentScript");

  const panel = panels.get(entry.nonce);

  if (!panel) {
    console.warn("Unknown panel: %s", entry.nonce);
    return;
  }

  // Panel entry may be undefined if the panel was registered with registerEmptyTemporaryPanel
  if (panel.entry && panel.entry.extensionId !== entry.extensionId) {
    throw new Error("extensionId mismatch");
  }

  panel.entry = entry;
}

/**
 * Register an empty panel for a given nonce and extensionId. Use to pre-allocate a "loading" state while the panel
 * content is being initialized.
 * @param nonce the panel nonce
 * @param extensionId the id of the extension that owns the panel
 * @param location the location of the panel
 */
export function registerEmptyTemporaryPanel({
  nonce,
  extensionId,
  location,
}: {
  nonce: UUID;
  extensionId: UUID;
  location: Location;
}) {
  expectContext("contentScript");

  if (panels.has(nonce)) {
    console.error(
      `A temporary panel was already registered with nonce ${nonce}`
    );
    return;
  }

  const registration = pDefer<PanelAction | null>();

  panels.set(nonce, {
    extensionId,
    registration,
    location,
  });

  if (!extensionNonces.has(extensionId)) {
    extensionNonces.set(extensionId, new Set());
  }

  extensionNonces.get(extensionId).add(nonce);
}

/**
 * Register a temporary display panel and wait fot its deferred promise
 * @param nonce The instance nonce for the panel to register
 * @param extensionId The extension id that owns the panel
 * @param location The location of the panel
 * @param entry the panel definition
 * @param onRegister callback to run after the panel is registered
 */
export async function waitForTemporaryPanel({
  nonce,
  location,
  entry,
  extensionId,
  onRegister,
}: {
  nonce: UUID;
  extensionId: UUID;
  location: Location;
  entry: Except<TemporaryPanelEntry, "type">;
  onRegister?: () => void;
}): Promise<PanelAction | null> {
  expectContext("contentScript");

  if (panels.has(nonce)) {
    console.warn(
      `A temporary panel was already registered with nonce ${nonce}`
    );
  }

  const registration =
    panels.get(nonce)?.registration ?? pDefer<PanelAction | null>();

  panels.set(nonce, {
    entry,
    location,
    extensionId,
    registration,
  });

  if (!extensionNonces.has(entry.extensionId)) {
    extensionNonces.set(entry.extensionId, new Set());
  }

  extensionNonces.get(entry.extensionId).add(nonce);

  onRegister?.();

  return registration.promise;
}

/**
 * Private helper method to remove panel from panels and extensionNonces.
 * @param panelNonce
 */
function removePanelEntry(panelNonce: UUID): void {
  const panel = panels.get(panelNonce);
  if (panel) {
    const { extensionId } = panel.entry;
    extensionNonces.get(extensionId).delete(panelNonce);
  }

  panels.delete(panelNonce);
}

/**
 * Resolve some temporary panels' deferred promises
 * @param nonces The nonces of the panels to resolve
 * @see resolveTemporaryPanel
 */
export async function stopWaitingForTemporaryPanels(nonces: UUID[]) {
  expectContext("contentScript");

  for (const nonce of nonces) {
    panels.get(nonce)?.registration.resolve();
    removePanelEntry(nonce);
  }
}

/**
 * Resolve some temporary panel with an action.
 * @param nonce The nonce of the panels to resolve
 * @param action The action to resolve the panel with
 */
export async function resolveTemporaryPanel(
  nonce: UUID,
  action: PanelAction
): Promise<void> {
  expectContext("contentScript");

  panels.get(nonce)?.registration.resolve(action);
  panels.delete(nonce);
}

/**
 * Cancel some temporary panels' deferred promises
 * @param nonces The nonces of the panels to reject with a CancelError
 * @param error The error to reject the panels with
 */
export async function cancelTemporaryPanels(
  nonces: UUID[],
  error?: unknown
): Promise<void> {
  expectContext("contentScript");

  let rejectError = error ?? new CancelError("User closed the panel");

  // :shrug: the error doesn't get deserialized by the messenger because it's not a rejection and the messenger
  // doesn't attempt to deserialize it. So we have to do it manually
  if (
    typeof error === "object" &&
    "name" in error &&
    error.name === "ClosePanelAction"
  ) {
    rejectError = new ClosePanelAction("User closed the panel");
  }

  for (const nonce of nonces) {
    panels.get(nonce)?.registration?.reject(rejectError);
    removePanelEntry(nonce);
  }
}

/**
 * Cancel all temporary panels for a given extension.
 * @see cancelTemporaryPanels
 */
export async function cancelTemporaryPanelsForExtension(
  extensionId: UUID
): Promise<void> {
  const nonces = extensionNonces.get(extensionId) ?? new Set();
  await cancelTemporaryPanels([...nonces]);
}
