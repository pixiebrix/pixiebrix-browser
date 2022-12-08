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

import { type Target } from "@/types";
import { type IExtension, type RegistryId, type UUID } from "@/core";
import { type FormState } from "@/pageEditor/extensionPoints/formStateTypes";
import { isExtension } from "@/pageEditor/sidebar/common";
import { type BlockConfig } from "@/blocks/types";
import ForEach from "@/blocks/transformers/controlFlow/ForEach";
import IfElse from "@/blocks/transformers/controlFlow/IfElse";
import TryExcept from "@/blocks/transformers/controlFlow/TryExcept";
import {
  type DocumentElement,
  isButtonElement,
  isListElement,
  isPipelineElement,
} from "@/components/documentBuilder/documentBuilderTypes";
import { joinPathParts } from "@/utils";
import ForEachElement from "@/blocks/transformers/controlFlow/ForEachElement";
import Retry from "@/blocks/transformers/controlFlow/Retry";
import { castArray } from "lodash";
import { type Annotation } from "@/analysis/analysisTypes";
import { PIPELINE_BLOCKS_FIELD_NAME } from "./consts";
import { isExpression } from "@/runtime/mapArgs";
import { expectContext } from "@/utils/expectContext";
import DisplayTemporaryInfo from "@/blocks/transformers/temporaryInfo/DisplayTemporaryInfo";

export async function getCurrentURL(): Promise<string> {
  expectContext("devTools");

  const tab = await browser.tabs.get(chrome.devtools.inspectedWindow.tabId);
  return tab.url;
}

/**
 * Message target for the tab being inspected by the devtools.
 *
 * The Page Editor only supports editing the top-level frame.
 */
export const thisTab: Target = {
  // This code might end up (unused) in non-dev bundles, so use `?.` to avoid errors from undefined values
  tabId: globalThis.chrome?.devtools?.inspectedWindow?.tabId ?? 0,
  // The top-level frame
  frameId: 0,
};

export function getIdForElement(element: IExtension | FormState): UUID {
  return isExtension(element) ? element.id : element.uuid;
}

export function getRecipeIdForElement(
  element: IExtension | FormState
): RegistryId {
  return isExtension(element) ? element._recipe?.id : element.recipe?.id;
}

export function getPipelinePropNames(block: BlockConfig): string[] {
  switch (block.id) {
    case ForEach.BLOCK_ID: {
      return ["body"];
    }

    case Retry.BLOCK_ID: {
      return ["body"];
    }

    case ForEachElement.BLOCK_ID: {
      return ["body"];
    }

    case DisplayTemporaryInfo.BLOCK_ID: {
      return ["body"];
    }

    case IfElse.BLOCK_ID: {
      return ["if", "else"];
    }

    case TryExcept.BLOCK_ID: {
      return ["try", "except"];
    }

    default: {
      return [];
    }
  }
}

export function getInputKeyForSubPipeline(
  blockConfig: BlockConfig,
  pipelinePropName: string
): string | null {
  let keyPropName: string = null;

  if (blockConfig.id === ForEach.BLOCK_ID && pipelinePropName === "body") {
    keyPropName = "elementKey";
  }

  if (blockConfig.id === TryExcept.BLOCK_ID && pipelinePropName === "except") {
    keyPropName = "errorKey";
  }

  if (!keyPropName) {
    return null;
  }

  // eslint-disable-next-line security/detect-object-injection -- not from user input
  const keyValue = blockConfig.config[keyPropName];

  if (!keyValue) {
    return null;
  }

  const realValue = isExpression(keyValue) ? keyValue.__value__ : keyValue;

  return realValue as string;
}

/**
 * Returns Formik path names to pipeline expressions
 * @param parentPath the parent Formik path
 * @param elements the document element or elements
 */
function getElementsPipelinePropNames(
  parentPath: string,
  elements: DocumentElement | DocumentElement[]
): string[] {
  const isArray = Array.isArray(elements);

  const propNames: string[] = [];
  for (const [elementIndex, element] of Object.entries(castArray(elements))) {
    const index = isArray ? elementIndex : null;

    if (isButtonElement(element)) {
      propNames.push(joinPathParts(parentPath, index, "config", "onClick"));
    } else if (isPipelineElement(element)) {
      propNames.push(joinPathParts(parentPath, index, "config", "pipeline"));
    } else if (isListElement(element)) {
      propNames.push(
        ...getElementsPipelinePropNames(
          joinPathParts(parentPath, index, "config", "element", "__value__"),
          element.config.element.__value__
        )
      );
    } else if (element.children?.length > 0) {
      propNames.push(
        ...getElementsPipelinePropNames(
          joinPathParts(parentPath, index, "children"),
          element.children
        )
      );
    }
  }

  return propNames;
}

export function getDocumentPipelinePaths(block: BlockConfig): string[] {
  return getElementsPipelinePropNames(
    "config.body",
    (block.config.body ?? []) as DocumentElement[]
  );
}

export function getFoundationNodeAnnotations(
  annotations: Annotation[]
): Annotation[] {
  return annotations.filter(
    (annotation) =>
      !annotation.position.path.startsWith(PIPELINE_BLOCKS_FIELD_NAME)
  );
}

export function getBlockAnnotations(
  blockPath: string,
  annotations: Annotation[]
): Annotation[] {
  const pathLength = blockPath.length;

  const relatedAnnotations = annotations.filter((annotation) =>
    annotation.position.path.startsWith(blockPath)
  );
  const ownAnnotations = relatedAnnotations.filter((annotation) => {
    const restPath = annotation.position.path.slice(pathLength);
    // XXX: this may be not a reliable way to determine if the annotation
    // is owned by the block or its sub pipeline.
    // It assumes that it's only the pipeline field that can have a ".__value__" followed by "." in the path,
    // and a pipeline field always has this pattern in its path.
    return !restPath.includes(".__value__.");
  });

  return ownAnnotations;
}
