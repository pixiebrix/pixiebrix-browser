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

import { deserializeError, serializeError } from "serialize-error";
import { makeRead, type ReaderTypeConfig } from "@/blocks/readers/factory";
import FRAMEWORK_ADAPTERS from "@/pageScript/frameworks/adapters";
import { getComponentData } from "@/pageScript/protocol";
import blockRegistry from "@/blocks/registry";
import { getCssSelector } from "css-selector-generator";
import {
  blockReducer,
  type IntermediateState,
  type ReduceOptions,
} from "@/runtime/reducePipeline";
import {
  type ApiVersion,
  type BlockArgContext,
  type IReader,
  type RegistryId,
  type UUID,
} from "@/core";
// eslint-disable-next-line import/no-restricted-paths -- Custom devTools mechanism to transfer data
import { selectedElement } from "@/pageEditor/getSelectedElement";
import { isNullOrBlank, resolveObj } from "@/utils";
import { type BlockConfig } from "@/blocks/types";
import { cloneDeep } from "lodash";
import ConsoleLogger from "@/utils/ConsoleLogger";
import { type SerializableResponse } from "@/messaging/protocol";
import apiVersionOptions from "@/runtime/apiVersionOptions";
import { $safeFind } from "@/helpers";
import { clearDynamicElements } from "@/contentScript/pageEditor/dynamic";
import { reactivateTab } from "./lifecycle";
import selection from "@/utils/selectionController";
import { BusinessError, NoRendererError } from "@/errors/businessErrors";
import { uuidv4 } from "@/types/helpers";
import { type PanelPayload } from "@/sidebar/types";
import { HeadlessModeError } from "@/blocks/errors";
import { showTemporarySidebarPanel } from "@/contentScript/sidebarController";
import { stopInspectingNativeHandler } from "./pageEditor/elementPicker";

async function read(factory: () => Promise<unknown>): Promise<unknown> {
  try {
    return await factory();
  } catch (error) {
    if (deserializeError(error).name === "ComponentNotFoundError") {
      return "Component not detected";
    }

    return { error };
  }
}

type RunBlockArgs = {
  apiVersion: ApiVersion;
  blockConfig: BlockConfig;
  /**
   * Context to render the BlockArg, should include @input, @options, and service context
   * @see makeServiceContext
   */
  context: BlockArgContext;
  /**
   * Root jQuery selector to determine the root if the rootMode is "inherit".
   * @see BlockConfig.rootMode
   */
  rootSelector: string | undefined;
};

/**
 * Run a single block (e.g., for generating output previews)
 * @see BlockPreview
 */
export async function runBlock({
  blockConfig,
  context,
  apiVersion,
  rootSelector,
}: RunBlockArgs): Promise<unknown> {
  const versionOptions = apiVersionOptions(apiVersion);

  if (!versionOptions.explicitDataFlow) {
    throw new BusinessError(
      "Preview only supported for extensions using runtime v2 or later"
    );
  }

  const state: IntermediateState = {
    context,
    // Can pick any index. It's only used for adding context to log messages, and we're disabling value logging
    // below with `logValues: false`
    index: 0,
    // Force isLastBlock so blockReducer does not complain about the outputKey being forced to undefined
    isLastBlock: true,
    // `root` is over-ridden below if rootSelector is provided
    root: document,
    // We're forcing apiVersion: 2 or higher above values must come from the context
    previousOutput: {},
  };

  if (rootSelector) {
    // Handle non-document contexts. If the selector is unique, this gives the root that would be available at runtime.
    // Differences in behavior:
    // - For triggers, the PixieBrix looks for the closest ancestor to the DOM event target matching the selector
    //   See TriggerExtensionPoint.eventHandler for reference
    // - For multi-menus (not currently available in the Page Editor), the below logic returns an arbitrary menu
    const rootElement = $safeFind(rootSelector);
    if (rootElement.length > 0) {
      state.root = rootElement.get(0);
    }
  }

  const options: ReduceOptions = {
    ...versionOptions,
    branches: [],
    headless: true,
    logValues: false,
    logger: new ConsoleLogger(),
    // Excluding runId will prevent the run from being stored in traces
    runId: null,
    extensionId: null,
  };

  // Exclude the outputKey so that `output` is the output of the brick. Alternatively we could have taken then
  // value from the context[outputKey] from the return value of blockReducer
  const { output } = await blockReducer(
    { ...blockConfig, outputKey: undefined },
    state,
    options
  );

  return cloneDeep(output) as SerializableResponse;
}

/**
 * Run a single renderer (e.g. - for running a block preview)
 *
 * Renderers need to be run with try-catch, catch the HeadlessModeError, and
 * use that to send the panel payload to the sidebar (or other target)
 * @see SidebarExtensionPoint
 *  starting on line 184, the call to reduceExtensionPipeline(),
 *  wrapped in a try-catch
 * @see executeBlockWithValidatedProps
 *  starting on line 323, the runRendererPipeline() function
 *
 * Note: Currently only implemented for the temporary sidebar panels
 * @see useDocumentPreviewRunBlock
 */
export async function runRendererBlock(
  extensionId: UUID,
  runId: UUID,
  title: string,
  args: RunBlockArgs
): Promise<void> {
  const nonce = uuidv4();

  let payload: PanelPayload;
  try {
    await runBlock(args);
    // We're expecting a HeadlessModeError (or other error) to be thrown in the line above
    // noinspection ExceptionCaughtLocallyJS
    throw new NoRendererError();
  } catch (error) {
    if (error instanceof HeadlessModeError) {
      payload = {
        key: nonce,
        blockId: error.blockId,
        args: error.args,
        ctxt: error.ctxt,
        extensionId,
        runId,
      };
    } else {
      payload = {
        key: nonce,
        error: serializeError(error),
        extensionId,
        runId,
      };
    }

    showTemporarySidebarPanel({
      extensionId: null,
      nonce,
      heading: title,
      payload,
    });
  }
}

export async function runReaderBlock({
  id,
  rootSelector,
}: {
  id: RegistryId;
  rootSelector?: string;
}) {
  const root = isNullOrBlank(rootSelector)
    ? document
    : $safeFind(rootSelector).get(0);

  if (id === "@pixiebrix/context-menu-data") {
    // HACK: special handling for context menu built-in
    if (root instanceof HTMLElement) {
      return {
        // TODO: extract the media type
        mediaType: null,
        // Use `innerText` because only want human readable elements
        // https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent#differences_from_innertext
        // eslint-disable-next-line unicorn/prefer-dom-node-text-content
        linkText: root.tagName === "A" ? root.innerText : null,
        linkUrl: root.tagName === "A" ? root.getAttribute("href") : null,
        srcUrl: root.getAttribute("src"),
        documentUrl: document.location.href,
      };
    }

    return {
      selectionText: selection.get(),
      documentUrl: document.location.href,
    };
  }

  const reader = (await blockRegistry.lookup(id)) as IReader;
  return reader.read(root);
}

export async function runReader({
  config,
  rootSelector,
}: {
  config: ReaderTypeConfig;
  rootSelector?: string;
}) {
  console.debug("runReader", { config, rootSelector });

  const root = isNullOrBlank(rootSelector)
    ? document
    : $safeFind(rootSelector).get(0);

  return makeRead(config)(root);
}

export async function readSelected() {
  if (selectedElement) {
    const selector = getCssSelector(selectedElement);
    console.debug(`Generated selector: ${selector}`);

    const base: Record<string, unknown> = {
      selector,
      htmlData: $(selectedElement).data(),
    };

    const frameworkData = await resolveObj(
      Object.fromEntries(
        [...FRAMEWORK_ADAPTERS.keys()].map((framework) => [
          framework,
          read(async () => getComponentData({ framework, selector })),
        ])
      )
    );

    return { ...base, ...frameworkData };
  }

  return {
    error: "No element selected",
  };
}

export async function resetTab(): Promise<void> {
  stopInspectingNativeHandler();
  await clearDynamicElements({});
  await reactivateTab();
}
