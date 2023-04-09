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

import { uuidv4, validateRegistryId } from "@/types/helpers";
import { type PipelineExpression } from "@/runtime/mapArgs";
import { expectContext } from "@/utils/expectContext";
import {
  ensureSidebar,
  hideTemporarySidebarPanel,
  PANEL_HIDING_EVENT,
  showTemporarySidebarPanel,
  updateTemporarySidebarPanel,
} from "@/contentScript/sidebarController";
import { type PanelPayload, type TemporaryPanelEntry } from "@/sidebar/types";
import {
  cancelTemporaryPanels,
  cancelTemporaryPanelsForExtension,
  stopWaitingForTemporaryPanels,
  updatePanelDefinition,
  waitForTemporaryPanel,
} from "@/blocks/transformers/temporaryInfo/temporaryPanelProtocol";
import { BusinessError, CancelError } from "@/errors/businessErrors";
import { getThisFrame } from "webext-messenger";
import { showModal } from "@/blocks/transformers/ephemeralForm/modalUtils";
import { IS_ROOT_AWARE_BRICK_PROPS } from "@/blocks/rootModeHelpers";
import {
  type Placement,
  showPopover,
} from "@/blocks/transformers/temporaryInfo/popoverUtils";
import { updateTemporaryOverlayPanel } from "@/contentScript/ephemeralPanelController";
import { once } from "lodash";
import { AbortPanelAction, ClosePanelAction } from "@/blocks/errors";
import { isSpecificError } from "@/errors/errorHelpers";
import { type Except, type JsonObject } from "type-fest";
import { type UUID } from "@/types/stringTypes";
import { Transformer } from "@/types/blocks/transformerTypes";
import { type Schema } from "@/types/schemaTypes";
import { type BlockArgs, type BlockOptions } from "@/types/runtimeTypes";

type Location = "panel" | "modal" | "popover";
// Match naming of the sidebar panel extension point triggers
export type RefreshTrigger = "manual" | "statechange";

export async function createFrameSource(
  nonce: string,
  mode: Location
): Promise<URL> {
  const target = await getThisFrame();

  const frameSource = new URL(browser.runtime.getURL("ephemeralPanel.html"));
  frameSource.searchParams.set("nonce", nonce);
  frameSource.searchParams.set("opener", JSON.stringify(target));
  frameSource.searchParams.set("mode", mode);
  return frameSource;
}

export type GetPanelEntry = () => Promise<
  Except<TemporaryPanelEntry, "type" | "nonce">
>;

export type TemporaryDisplayInputs = {
  /**
   * Factory method to generate the temporary panel entry.
   */
  getPanelEntry: GetPanelEntry;
  /**
   * The location to display the panel.
   */
  location: Location;
  /**
   * Target element for popover.
   */
  target: HTMLElement | Document;
  /**
   * An optional abortSignal to cancel the panel.
   */
  signal?: AbortSignal;

  /**
   * An optional trigger to trigger a panel refresh.
   */
  refreshTrigger?: RefreshTrigger;

  /**
   * Handler when the user clicks outside the modal/popover.
   */
  onOutsideClick?: (nonce: UUID) => void;

  /**
   * Handler when the user clicks the close button on the modal/popover. If not provided, don't show the button.
   */
  onCloseClick?: (nonce: UUID) => void;

  /**
   * Optional placement options for popovers.
   */
  popoverOptions?: {
    /**
     * The placement of the popover, default 'auto'
     */
    placement?: Placement;
  };
};

/**
 * Display a brick in a temporary panel: sidebar, modal, or popover.
 * @param getPanelEntry factory to generate the panel entry
 * @param location the location to show the panel
 * @param signal abort signal
 * @param target target element, if location is popover
 * @param refreshTrigger optional trigger to refresh the panel
 * @param popoverOptions optional popover options
 * @param onOutsideClick optional callback to invoke when the user clicks outside the popover/modal
 * @param onCloseClick optional callback to invoke when the user clicks the close button on the popover/modal
 */
export async function displayTemporaryInfo({
  getPanelEntry,
  location,
  signal,
  target,
  refreshTrigger,
  popoverOptions,
  onOutsideClick,
  onCloseClick,
}: TemporaryDisplayInputs): Promise<JsonObject> {
  const nonce = uuidv4();
  const entry = await getPanelEntry();
  let onReady: () => void;

  const controller = new AbortController();

  signal?.addEventListener("abort", () => {
    void cancelTemporaryPanels([nonce]);
  });

  switch (location) {
    case "panel": {
      await ensureSidebar();

      showTemporarySidebarPanel({ ...entry, nonce });

      window.addEventListener(
        PANEL_HIDING_EVENT,
        () => {
          controller.abort();
        },
        {
          signal: controller.signal,
        }
      );

      controller.signal.addEventListener("abort", () => {
        hideTemporarySidebarPanel(nonce);
        void stopWaitingForTemporaryPanels([nonce]);
      });

      break;
    }

    case "modal": {
      const frameSource = await createFrameSource(nonce, location);
      showModal({
        url: frameSource,
        controller,
        onOutsideClick() {
          // Unlike popover, the default behavior for modal is to force interaction
          if (onOutsideClick) {
            onOutsideClick(nonce);
          }
        },
      });
      break;
    }

    case "popover": {
      const frameSource = await createFrameSource(nonce, location);
      if (target === document) {
        throw new BusinessError("Target must be an element for popover");
      }

      await cancelTemporaryPanelsForExtension(entry.extensionId);

      const popover = showPopover({
        url: frameSource,
        element: target as HTMLElement,
        signal: controller.signal,
        options: popoverOptions,
        onOutsideClick() {
          if (onOutsideClick) {
            onOutsideClick(nonce);
          } else {
            // Default behavior is to resolve the panel without an action
            void cancelTemporaryPanels([nonce]);
          }
        },
      });

      // Wrap in once so it's safe for refresh callback
      onReady = once(() => {
        popover.onReady();
      });

      break;
    }

    default: {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- dynamic check for never
      throw new BusinessError(`Invalid location: ${location}`);
    }
  }

  const rerender = async () => {
    try {
      const newEntry = { ...(await getPanelEntry()), nonce };
      // Force a re-render by changing the key
      newEntry.payload.key = uuidv4();

      updatePanelDefinition(newEntry);

      if (location === "panel") {
        updateTemporarySidebarPanel(newEntry);
      } else {
        updateTemporaryOverlayPanel(newEntry);
      }
    } catch (error) {
      // XXX: in the future, we may want to updatePanelDefinition with the error
      console.warn("Ignoring error re-rendering temporary panel", error);
    }
  };

  if (refreshTrigger === "statechange") {
    $(document).on("statechange", rerender);
  }

  let result = null;

  try {
    result = await waitForTemporaryPanel(
      nonce,
      { ...entry, nonce },
      { onRegister: onReady }
    );
  } catch (error) {
    if (isSpecificError(error, ClosePanelAction)) {
      onCloseClick?.(nonce);
    } else if (isSpecificError(error, AbortPanelAction)) {
      // Must be before isSpecificError(error, CancelError) because CancelError is a subclass of AbortPanelAction
      throw error;
    } else if (isSpecificError(error, CancelError)) {
      // See discussion at: https://github.com/pixiebrix/pixiebrix-extension/pull/4915
      // For temporary forms, we throw the CancelError because typically the form is input to additional bricks.
      // For temporary information, typically the information is displayed as the last brick in the action.
      // Given that this brick doesn't return any values currently, we'll just swallow the error and return normally
      // NOP
    } else {
      throw error;
    }
  } finally {
    controller.abort();
    $(document).off("statechange", rerender);
  }

  return result ?? {};
}

class DisplayTemporaryInfo extends Transformer {
  static BLOCK_ID = validateRegistryId("@pixiebrix/display");
  defaultOutputKey = "infoOutput";

  constructor() {
    super(
      DisplayTemporaryInfo.BLOCK_ID,
      "Display Temporary Information",
      "Display a document in a temporary sidebar panel"
    );
  }

  override async isRootAware(): Promise<boolean> {
    return true;
  }

  inputSchema: Schema = {
    type: "object",
    properties: {
      title: {
        type: "string",
        description:
          "A display title for the temporary document, shown in the tab name",
      },
      body: {
        $ref: "https://app.pixiebrix.com/schemas/pipeline#",
        description: "The render pipeline for the temporary document",
      },
      location: {
        type: "string",
        enum: ["panel", "modal", "popover"],
        default: "panel",
        description: "The location of the information (default='panel')",
      },
      refreshTrigger: {
        type: "string",
        enum: ["manual", "statechange"],
        description: "An optional trigger for refreshing the document",
      },
      ...IS_ROOT_AWARE_BRICK_PROPS,
    },
    required: ["body"],
  };

  async transform(
    {
      title,
      body: bodyPipeline,
      location = "panel",
      refreshTrigger = "manual",
      isRootAware = false,
    }: BlockArgs<{
      title: string;
      location: Location;
      refreshTrigger: RefreshTrigger;
      body: PipelineExpression;
      isRootAware: boolean;
    }>,
    {
      logger: {
        context: { extensionId },
      },
      root,
      ctxt,
      runPipeline,
      runRendererPipeline,
      abortSignal,
    }: BlockOptions
  ): Promise<JsonObject | null> {
    expectContext("contentScript");

    const target = isRootAware ? root : document;

    // Counter for tracking branch execution
    let counter = 0;

    const getPanelEntry: GetPanelEntry = async () => {
      const payload = (await runRendererPipeline(
        bodyPipeline?.__value__ ?? [],
        {
          key: "body",
          counter,
        },
        {},
        target
      )) as PanelPayload;

      counter++;

      return {
        heading: title,
        payload,
        extensionId,
      };
    };

    return displayTemporaryInfo({
      getPanelEntry,
      location,
      signal: abortSignal,
      target,
      refreshTrigger,
    });
  }
}

export default DisplayTemporaryInfo;
