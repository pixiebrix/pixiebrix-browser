/*
 * Copyright (C) 2021 PixieBrix, Inc.
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

import { deserializeError } from "serialize-error";
import { makeRead, ReaderTypeConfig } from "@/blocks/readers/factory";
import FRAMEWORK_ADAPTERS from "@/frameworks/adapters";
import { getComponentData } from "@/pageScript/protocol";
import blockRegistry from "@/blocks/registry";
import { getCssSelector } from "css-selector-generator";
import {
  blockReducer,
  IntermediateState,
  ReduceOptions,
} from "@/runtime/reducePipeline";
import { ApiVersion, BlockArgContext, IReader, RegistryId } from "@/core";
import { selectedElement } from "@/devTools/getSelectedElement";
import { isNullOrBlank, resolveObj } from "@/utils";
import { BlockConfig } from "@/blocks/types";
import { cloneDeep } from "lodash";
import ConsoleLogger from "@/tests/ConsoleLogger";
import { SerializableResponse } from "@/messaging/protocol";
import apiVersionOptions from "@/runtime/apiVersionOptions";
import { BusinessError } from "@/errors";
import { $safeFind } from "@/helpers";

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
};

/**
 * Run a single block (e.g., for generating output previews)
 * @see BlockPreview
 */
export async function runBlock({
  blockConfig,
  context,
  apiVersion,
}: RunBlockArgs) {
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
    // TODO: need to support other roots for triggers. Or we at least need to throw an error so we can show a message
    //  in the UX that non-root contexts aren't supported
    root: document,
    // We're forcing apiVersion: 2 or higher above values must come from the context
    previousOutput: {},
  };

  const options: ReduceOptions = {
    ...versionOptions,
    headless: true,
    logValues: false,
    logger: new ConsoleLogger(),
    runId: null,
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
      selectionText: window.getSelection().toString(),
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
