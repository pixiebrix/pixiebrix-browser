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

import { type Metadata } from "@/types/registryTypes";
import { type ModComponentBase } from "@/types/extensionTypes";
import {
  baseFromExtension,
  baseSelectExtension,
  baseSelectExtensionPoint,
  cleanIsAvailable,
  extensionWithNormalizedPipeline,
  getImplicitReader,
  lookupExtensionPoint,
  makeInitialBaseState,
  makeIsAvailable,
  removeEmptyValues,
  selectIsAvailable,
} from "@/pageEditor/extensionPoints/base";
import { omitEditorMetadata } from "./pipelineMapping";
import { type StarterBrickConfig } from "@/extensionPoints/types";
import { faThLarge } from "@fortawesome/free-solid-svg-icons";
import {
  type ElementConfig,
  type SingleLayerReaderConfig,
} from "@/pageEditor/extensionPoints/elementConfig";
import {
  type QuickBarConfig,
  type QuickBarDefinition,
  QuickBarStarterBrickABC,
} from "@/extensionPoints/quickBarExtension";
import QuickBarConfiguration from "@/pageEditor/tabs/quickBar/QuickBarConfiguration";
import type { DynamicDefinition } from "@/contentScript/pageEditor/types";
import { type QuickBarFormState } from "./formStateTypes";

function fromNativeElement(url: string, metadata: Metadata): QuickBarFormState {
  const base = makeInitialBaseState();

  const isAvailable = makeIsAvailable(url);

  const title = "Quick Bar item";

  return {
    type: "quickBar",
    // To simplify the interface, this is kept in sync with the caption
    label: title,
    ...base,
    extensionPoint: {
      metadata,
      definition: {
        type: "quickBar",
        reader: getImplicitReader("quickBar"),
        documentUrlPatterns: isAvailable.matchPatterns,
        contexts: ["all"],
        targetMode: "eventTarget",
        defaultOptions: {},
        isAvailable,
      },
    },
    extension: {
      title,
      blockPipeline: [],
    },
  };
}

function selectExtensionPointConfig(
  formState: QuickBarFormState
): StarterBrickConfig<QuickBarDefinition> {
  const { extensionPoint } = formState;
  const {
    definition: {
      isAvailable,
      documentUrlPatterns,
      reader,
      targetMode,
      contexts = ["all"],
    },
  } = extensionPoint;
  return removeEmptyValues({
    ...baseSelectExtensionPoint(formState),
    definition: {
      type: "quickBar",
      documentUrlPatterns,
      contexts,
      targetMode,
      reader,
      isAvailable: cleanIsAvailable(isAvailable),
    },
  });
}

function selectExtension(
  state: QuickBarFormState,
  options: { includeInstanceIds?: boolean } = {}
): ModComponentBase<QuickBarConfig> {
  const { extension } = state;
  const config: QuickBarConfig = {
    title: extension.title,
    icon: extension.icon,
    action: options.includeInstanceIds
      ? extension.blockPipeline
      : omitEditorMetadata(extension.blockPipeline),
  };
  return removeEmptyValues({
    ...baseSelectExtension(state),
    config,
  });
}

async function fromExtension(
  config: ModComponentBase<QuickBarConfig>
): Promise<QuickBarFormState> {
  const extensionPoint = await lookupExtensionPoint<
    QuickBarDefinition,
    QuickBarConfig,
    "quickBar"
  >(config, "quickBar");

  const { documentUrlPatterns, defaultOptions, contexts, targetMode, reader } =
    extensionPoint.definition;

  const base = baseFromExtension(config, extensionPoint.definition.type);
  const extension = await extensionWithNormalizedPipeline(
    config.config,
    "action"
  );

  return {
    ...base,

    extension,

    extensionPoint: {
      metadata: extensionPoint.metadata,
      definition: {
        type: "quickBar",
        documentUrlPatterns,
        defaultOptions,
        targetMode,
        contexts,
        // See comment on SingleLayerReaderConfig
        reader: reader as SingleLayerReaderConfig,
        isAvailable: selectIsAvailable(extensionPoint),
      },
    },
  };
}

function asDynamicElement(element: QuickBarFormState): DynamicDefinition {
  return {
    type: "quickBar",
    extension: selectExtension(element, { includeInstanceIds: true }),
    extensionPointConfig: selectExtensionPointConfig(element),
  };
}

const config: ElementConfig<undefined, QuickBarFormState> = {
  displayOrder: 1,
  elementType: "quickBar",
  label: "Quick Bar Action",
  baseClass: QuickBarStarterBrickABC,
  EditorNode: QuickBarConfiguration,
  selectNativeElement: undefined,
  icon: faThLarge,
  fromNativeElement,
  asDynamicElement,
  selectExtensionPointConfig,
  selectExtension,
  fromExtension,
};

export default config;
