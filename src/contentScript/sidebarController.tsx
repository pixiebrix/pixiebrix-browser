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
import { reportEvent } from "@/telemetry/events";
import { expectContext } from "@/utils/expectContext";
import sidebarInThisTab from "@/sidebar/messenger/api";
import { isEmpty } from "lodash";
import { logPromiseDuration } from "@/utils";
import { SimpleEventTarget } from "@/utils/SimpleEventTarget";
import {
  insertSidebarFrame,
  isSidebarFrameVisible,
  removeSidebarFrame,
} from "./sidebarDomControllerLite";
import { type Except } from "type-fest";
import { type RunArgs, RunReason } from "@/types/runtimeTypes";
import { type UUID } from "@/types/stringTypes";
import { type RegistryId } from "@/types/registryTypes";
import { type ExtensionRef } from "@/types/extensionTypes";
import type {
  ActivatePanelOptions,
  ActivateRecipePanelEntry,
  FormPanelEntry,
  PanelEntry,
  PanelPayload,
  TemporaryPanelEntry,
} from "@/types/sidebarTypes";
import { getTemporaryPanelSidebarEntries } from "@/blocks/transformers/temporaryInfo/temporaryPanelProtocol";
import { getFormPanelSidebarEntries } from "@/contentScript/ephemeralFormProtocol";

export const HIDE_SIDEBAR_EVENT_NAME = "pixiebrix:hideSidebar";

/**
 * Sequence number for ensuring render requests are handled in order
 */
let renderSequenceNumber = 0;

/**
 * Event listeners triggered when the sidebar shows and is ready to receive messages.
 */
export const sidebarShowEvents = new SimpleEventTarget<RunArgs>();

const panels: PanelEntry[] = [];

let recipeToActivate: ActivateRecipePanelEntry = null;

/**
 * Attach the sidebar to the page if it's not already attached. Then re-renders all panels.
 * @param activateOptions options controlling the visible panel in the sidebar
 */
export async function showSidebar(
  activateOptions: ActivatePanelOptions = {}
): Promise<void> {
  reportEvent("SidePanelShow");
  const isAlreadyShowing = isSidebarFrameVisible();

  if (!isAlreadyShowing) {
    insertSidebarFrame();
  }

  try {
    await sidebarInThisTab.pingSidebar();
  } catch (error) {
    throw new Error("The sidebar did not respond in time", { cause: error });
  }

  if (!isAlreadyShowing || (activateOptions.refresh ?? true)) {
    // Run the sidebar extension points available on the page. If the sidebar is already in the page, running
    // all the callbacks ensures the content is up-to-date

    // Currently, this runs the listening SidebarExtensionPoint.run callbacks in not particular order. Also note that
    // we're not awaiting their resolution (because they may contain long-running bricks).
    sidebarShowEvents.emit({ reason: RunReason.MANUAL });
  }

  if (!isEmpty(activateOptions)) {
    const seqNum = renderSequenceNumber;
    renderSequenceNumber++;

    // The sidebarSlice handles the race condition with the panels loading by keeping track of the latest pending
    // activatePanel request.
    void sidebarInThisTab
      .activatePanel(seqNum, {
        ...activateOptions,
        // If the sidebar wasn't showing, force the behavior. (Otherwise, there's a race on the initial activation,
        // where depending on when the message is received, the sidebar might already be showing a panel)
        force: activateOptions.force || !isAlreadyShowing,
      })
      // eslint-disable-next-line promise/prefer-await-to-then -- not in an async method
      .catch((error: unknown) => {
        reportError(
          new Error("Error activating sidebar panel", { cause: error })
        );
      });
  }
}

/**
 * Force-show the panel for the given extension id
 * @param extensionId the extension UUID
 */
export async function activateExtensionPanel(extensionId: UUID): Promise<void> {
  expectContext("contentScript");

  if (!isSidebarFrameVisible()) {
    console.warn("sidebar is not attached to the page");
  }

  const seqNum = renderSequenceNumber;
  renderSequenceNumber++;

  void sidebarInThisTab.activatePanel(seqNum, {
    extensionId,
    force: true,
  });
}

/**
 * Awaitable version of showSidebar which does not reload existing panels if the sidebar is already visible
 * @see showSidebar
 */
export async function ensureSidebar(): Promise<void> {
  if (!isSidebarFrameVisible()) {
    expectContext("contentScript");
    await logPromiseDuration("ensureSidebar", showSidebar());
  }
}

export function hideSidebar(): void {
  reportEvent("SidePanelHide");
  removeSidebarFrame();
  window.dispatchEvent(new CustomEvent(HIDE_SIDEBAR_EVENT_NAME));
}

/**
 * Reload the sidebar and its content.
 *
 * Known limitations:
 * - Does not reload ephemeral forms
 */
export async function reloadSidebar(): Promise<void> {
  // Need to hide and re-show because the controller sends the content on load. The sidebar doesn't automatically
  // request its own content on mount.

  if (isSidebarFrameVisible()) {
    hideSidebar();
  }

  await showSidebar();
}

/**
 * Rehydrate the already visible sidebar.
 *
 * For use with background/browserAction.
 * - `browserAction` calls toggleSidebarFrame to immediately adds the sidebar iframe
 * - It injects the content script
 * - It calls this method via messenger to complete the sidebar initialization
 * but the content
 */
export function rehydrateSidebar(): void {
  // To assist with debugging race conditions in sidebar initialization
  console.debug("sidebarController:rehydrateSidebar", {
    isSidebarFrameVisible: isSidebarFrameVisible(),
  });

  if (isSidebarFrameVisible()) {
    // `showSidebar` includes the logic to hydrate it
    // `refresh: true` is the default, but be explicit that the sidebarShowEvents must run.
    void showSidebar({ refresh: true });
  } else {
    // `hideSidebar` includes events to cleanup the sidebar
    hideSidebar();
  }
}

function renderPanelsIfVisible(): void {
  expectContext("contentScript");

  if (isSidebarFrameVisible()) {
    const seqNum = renderSequenceNumber;
    renderSequenceNumber++;
    void sidebarInThisTab.renderPanels(seqNum, panels);
  } else {
    console.debug("Skipping renderPanels because the sidebar is not visible");
  }
}

export function showSidebarForm(entry: Except<FormPanelEntry, "type">): void {
  expectContext("contentScript");

  if (!isSidebarFrameVisible()) {
    throw new Error("Cannot add sidebar form if the sidebar is not visible");
  }

  const seqNum = renderSequenceNumber;
  renderSequenceNumber++;
  void sidebarInThisTab.showForm(seqNum, { type: "form", ...entry });
}

export function hideSidebarForm(nonce: UUID): void {
  expectContext("contentScript");

  if (!isSidebarFrameVisible()) {
    // Already hidden
    return;
  }

  const seqNum = renderSequenceNumber;
  renderSequenceNumber++;
  void sidebarInThisTab.hideForm(seqNum, nonce);
}

export function showTemporarySidebarPanel(
  entry: Except<TemporaryPanelEntry, "type">
): void {
  expectContext("contentScript");

  if (!isSidebarFrameVisible()) {
    throw new Error(
      "Cannot add temporary sidebar panel if the sidebar is not visible"
    );
  }

  const sequence = renderSequenceNumber++;
  void sidebarInThisTab.showTemporaryPanel(sequence, {
    type: "temporaryPanel",
    ...entry,
  });
}

export function updateTemporarySidebarPanel(
  entry: Except<TemporaryPanelEntry, "type">
): void {
  expectContext("contentScript");

  if (!isSidebarFrameVisible()) {
    throw new Error(
      "Cannot add temporary sidebar panel if the sidebar is not visible"
    );
  }

  const sequence = renderSequenceNumber++;
  sidebarInThisTab.updateTemporaryPanel(sequence, {
    type: "temporaryPanel",
    ...entry,
  });
}

export function hideTemporarySidebarPanel(nonce: UUID): void {
  expectContext("contentScript");

  if (!isSidebarFrameVisible()) {
    return;
  }

  const sequence = renderSequenceNumber++;
  void sidebarInThisTab.hideTemporaryPanel(sequence, nonce);
}

export function removeExtension(extensionId: UUID): void {
  expectContext("contentScript");

  // `panels` is const, so replace the contents
  const current = panels.splice(0, panels.length);
  panels.push(...current.filter((x) => x.extensionId !== extensionId));
  renderPanelsIfVisible();
}

/**
 * Remove all panels associated with the given extensionPointId.
 * @param extensionPointId the extension point id (internal or external)
 * @param preserveExtensionIds array of extension ids to keep in the panel. Used to avoid flickering if updating
 * the extensionPoint for a sidebar extension from the Page Editor
 */
export function removeExtensionPoint(
  extensionPointId: RegistryId,
  { preserveExtensionIds = [] }: { preserveExtensionIds?: UUID[] } = {}
): void {
  expectContext("contentScript");

  console.debug("removeExtensionPoint %s", extensionPointId, {
    preserveExtensionIds,
  });

  // `panels` is const, so replace the contents
  const current = panels.splice(0, panels.length);
  panels.push(
    ...current.filter(
      (x) =>
        x.extensionPointId !== extensionPointId ||
        preserveExtensionIds.includes(x.extensionId)
    )
  );
  renderPanelsIfVisible();
}

/**
 * Create placeholder panels showing loading indicators
 */
export function reservePanels(refs: ExtensionRef[]): void {
  if (refs.length === 0) {
    return;
  }

  const current = new Set(panels.map((x) => x.extensionId));
  for (const { extensionId, extensionPointId, blueprintId } of refs) {
    if (!current.has(extensionId)) {
      const entry: PanelEntry = {
        type: "panel",
        extensionId,
        extensionPointId,
        blueprintId,
        heading: null,
        payload: null,
      };

      console.debug(
        "reservePanels: reserve panel %s for %s",
        extensionId,
        extensionPointId,
        blueprintId,
        { ...entry }
      );

      panels.push(entry);
    }
  }

  renderPanelsIfVisible();
}

export function updateHeading(extensionId: UUID, heading: string): void {
  const entry = panels.find((x) => x.extensionId === extensionId);
  if (entry) {
    entry.heading = heading;
    console.debug(
      "updateHeading: update heading for panel %s for %s",
      extensionId,
      entry.extensionPointId,
      { ...entry }
    );
    renderPanelsIfVisible();
  } else {
    console.warn(
      "updateHeading: No panel exists for extension %s",
      extensionId
    );
  }
}

export function upsertPanel(
  { extensionId, extensionPointId, blueprintId }: ExtensionRef,
  heading: string,
  payload: PanelPayload
): void {
  const entry = panels.find((panel) => panel.extensionId === extensionId);
  if (entry) {
    entry.payload = payload;
    entry.heading = heading;
    console.debug(
      "upsertPanel: update existing panel %s for %s",
      extensionId,
      extensionPointId,
      blueprintId,
      { ...entry }
    );
  } else {
    console.debug(
      "upsertPanel: add new panel %s for %s",
      extensionId,
      extensionPointId,
      blueprintId,
      {
        entry,
        extensionPointId,
        heading,
        payload,
      }
    );
    panels.push({
      type: "panel",
      extensionId,
      extensionPointId,
      blueprintId,
      heading,
      payload,
    });
  }

  renderPanelsIfVisible();
}

export function showActivateRecipeInSidebar(
  entry: Except<ActivateRecipePanelEntry, "type">
): void {
  expectContext("contentScript");

  if (!isSidebarFrameVisible()) {
    throw new Error(
      "Cannot activate a recipe in the sidebar if the sidebar is not visible"
    );
  }

  recipeToActivate = {
    type: "activateRecipe",
    ...entry,
  };

  const sequence = renderSequenceNumber++;
  void sidebarInThisTab.showActivateRecipe(sequence, recipeToActivate);
}

export function hideActivateRecipeInSidebar(recipeId: RegistryId): void {
  expectContext("contentScript");

  recipeToActivate = null;

  if (!isSidebarFrameVisible()) {
    return;
  }

  const sequence = renderSequenceNumber++;
  void sidebarInThisTab.hideActivateRecipe(sequence, recipeId);
}

/**
 * Return the panels that are "reserved", that will be shown when the sidebar is shown. The content may not be computed
 * yet. This includes:
 * - Permanent panels added by sidebarExtension
 * - Temporary panels added by DisplayTemporaryInfo
 * - Temporary form definitions added by ephemeralForm
 * - Activate Recipe panel added by sidebarActivation.ts activate button click-handlers
 */
export function getReservedPanelEntries(): {
  panels: PanelEntry[];
  temporaryPanels: TemporaryPanelEntry[];
  forms: FormPanelEntry[];
  recipeToActivate: ActivateRecipePanelEntry | null;
} {
  return {
    panels,
    temporaryPanels: getTemporaryPanelSidebarEntries(),
    forms: getFormPanelSidebarEntries(),
    recipeToActivate,
  };
}
