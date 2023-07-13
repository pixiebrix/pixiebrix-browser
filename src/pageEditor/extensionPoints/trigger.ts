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
import {
  baseFromExtension,
  baseSelectExtension,
  baseSelectExtensionPoint,
  extensionWithNormalizedPipeline,
  getImplicitReader,
  lookupExtensionPoint,
  makeInitialBaseState,
  makeIsAvailable,
  readerTypeHack,
  removeEmptyValues,
  selectIsAvailable,
} from "@/pageEditor/extensionPoints/base";
import { omitEditorMetadata } from "./pipelineMapping";
import {
  getDefaultReportModeForTrigger,
  type TriggerConfig,
  type TriggerDefinition,
  TriggerExtensionPoint,
} from "@/extensionPoints/triggerExtension";
import { type StarterBrickConfig } from "@/extensionPoints/types";
import { identity, pickBy } from "lodash";
import { getDomain } from "@/permissions/patterns";
import { faBolt } from "@fortawesome/free-solid-svg-icons";
import { type ElementConfig } from "@/pageEditor/extensionPoints/elementConfig";
import TriggerConfiguration from "@/pageEditor/tabs/trigger/TriggerConfiguration";
import type { DynamicDefinition } from "@/contentScript/pageEditor/types";
import { type TriggerFormState } from "./formStateTypes";
import { type ModComponentBase } from "@/types/extensionTypes";

function fromNativeElement(
  url: string,
  metadata: Metadata,
  _element: null
): TriggerFormState {
  return {
    type: "trigger",
    label: `My ${getDomain(url)} trigger`,
    ...makeInitialBaseState(),
    extensionPoint: {
      metadata,
      definition: {
        type: "trigger",
        trigger: "load",
        rootSelector: null,
        attachMode: null,
        targetMode: null,
        // Use "once" for reportMode, since the default is "load"
        reportMode: "once",
        intervalMillis: null,
        background: null,
        debounce: null,
        customEvent: null,
        reader: getImplicitReader("trigger"),
        isAvailable: makeIsAvailable(url),
      },
    },
    extension: {
      blockPipeline: [],
    },
  };
}

function selectExtensionPointConfig(
  formState: TriggerFormState
): StarterBrickConfig<TriggerDefinition> {
  const { extensionPoint } = formState;
  const {
    definition: {
      isAvailable,
      rootSelector,
      attachMode,
      targetMode,
      reportMode,
      debounce,
      customEvent,
      intervalMillis,
      background,
      reader,
      trigger,
    },
  } = extensionPoint;
  return removeEmptyValues({
    ...baseSelectExtensionPoint(formState),
    definition: {
      type: "trigger",
      reader,
      isAvailable: pickBy(isAvailable, identity),
      trigger,
      debounce,
      customEvent,
      intervalMillis,
      background,
      attachMode,
      targetMode,
      reportMode: reportMode ?? getDefaultReportModeForTrigger(trigger),
      rootSelector,
    },
  });
}

function selectExtension(
  state: TriggerFormState,
  options: { includeInstanceIds?: boolean } = {}
): ModComponentBase<TriggerConfig> {
  const { extension } = state;
  const config: TriggerConfig = {
    action: options.includeInstanceIds
      ? extension.blockPipeline
      : omitEditorMetadata(extension.blockPipeline),
  };
  return removeEmptyValues({
    ...baseSelectExtension(state),
    config,
  });
}

function asDynamicElement(element: TriggerFormState): DynamicDefinition {
  return {
    type: "trigger",
    extension: selectExtension(element, { includeInstanceIds: true }),
    extensionPointConfig: selectExtensionPointConfig(element),
  };
}

async function fromExtension(
  config: ModComponentBase<TriggerConfig>
): Promise<TriggerFormState> {
  const extensionPoint = await lookupExtensionPoint<
    TriggerDefinition,
    TriggerConfig,
    "trigger"
  >(config, "trigger");

  const {
    rootSelector,
    attachMode,
    targetMode,
    reportMode,
    trigger,
    reader,
    background,
    intervalMillis,
    debounce,
    customEvent,
  } = extensionPoint.definition;

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
        type: extensionPoint.definition.type,
        rootSelector,
        trigger,
        attachMode,
        targetMode,
        reportMode,
        customEvent,
        debounce,
        background,
        intervalMillis,
        reader: readerTypeHack(reader),
        isAvailable: selectIsAvailable(extensionPoint),
      },
    },
  };
}

const config: ElementConfig<undefined, TriggerFormState> = {
  displayOrder: 4,
  elementType: "trigger",
  label: "Trigger",
  baseClass: TriggerExtensionPoint,
  EditorNode: TriggerConfiguration,
  selectNativeElement: undefined,
  icon: faBolt,
  fromNativeElement,
  asDynamicElement,
  selectExtensionPointConfig,
  selectExtension,
  fromExtension,
};

export default config;
