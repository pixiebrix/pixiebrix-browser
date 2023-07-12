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
import { type IExtension } from "@/types/extensionTypes";
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
  type MenuDefinition,
  type MenuItemExtensionConfig,
  MenuItemExtensionPoint,
} from "@/extensionPoints/menuItemExtension";
import { type StarterBrickConfig } from "@/extensionPoints/types";
import { identity, pickBy } from "lodash";
import { getDomain } from "@/permissions/patterns";
import { faMousePointer } from "@fortawesome/free-solid-svg-icons";
import { type ElementConfig } from "@/pageEditor/extensionPoints/elementConfig";
import MenuItemConfiguration from "@/pageEditor/tabs/menuItem/MenuItemConfiguration";
import { insertButton } from "@/contentScript/messenger/api";
import {
  type ButtonDefinition,
  type ButtonSelectionResult,
} from "@/contentScript/pageEditor/types";
import { type ActionFormState } from "./formStateTypes";

function fromNativeElement(
  url: string,
  metadata: Metadata,
  button: ButtonSelectionResult
): ActionFormState {
  return {
    type: "menuItem",
    label: `My ${getDomain(url)} button`,
    ...makeInitialBaseState(button.uuid),
    containerInfo: button.containerInfo,
    extensionPoint: {
      metadata,
      definition: {
        ...button.menu,
        type: "menuItem",
        reader: getImplicitReader("menuItem"),
        isAvailable: makeIsAvailable(url),
        targetMode: "document",
        attachMode: "once",
      },
      traits: {
        style: {
          mode: "inherit",
        },
      },
    },
    extension: {
      caption: button.item.caption,
      blockPipeline: [],
      dynamicCaption: false,
      onSuccess: true,
      synchronous: false,
    },
  };
}

function selectExtensionPointConfig(
  formState: ActionFormState
): StarterBrickConfig<MenuDefinition> {
  const { extensionPoint } = formState;
  const {
    definition: {
      isAvailable,
      position,
      template,
      reader,
      containerSelector,
      targetMode,
      attachMode,
    },
  } = extensionPoint;
  return removeEmptyValues({
    ...baseSelectExtensionPoint(formState),
    definition: {
      type: "menuItem",
      reader,
      isAvailable: pickBy(isAvailable, identity),
      containerSelector,
      targetMode,
      attachMode,
      position,
      template,
    },
  });
}

function selectExtension(
  state: ActionFormState,
  options: { includeInstanceIds?: boolean } = {}
): IExtension<MenuItemExtensionConfig> {
  const { extension } = state;
  const config: MenuItemExtensionConfig = {
    caption: extension.caption,
    icon: extension.icon,
    action: options.includeInstanceIds
      ? extension.blockPipeline
      : omitEditorMetadata(extension.blockPipeline),
    dynamicCaption: extension.dynamicCaption,
    onSuccess: extension.onSuccess,
    synchronous: extension.synchronous,
  };
  return removeEmptyValues({
    ...baseSelectExtension(state),
    config,
  });
}

async function fromExtension(
  config: IExtension<MenuItemExtensionConfig>
): Promise<ActionFormState> {
  const extensionPoint = await lookupExtensionPoint<
    MenuDefinition,
    MenuItemExtensionConfig,
    "menuItem"
  >(config, "menuItem");

  const base = baseFromExtension(config, extensionPoint.definition.type);
  const extension = await extensionWithNormalizedPipeline(
    config.config,
    "action"
  );

  return {
    ...base,

    extension,

    // `containerInfo` only populated on initial creation session
    containerInfo: null,

    extensionPoint: {
      metadata: extensionPoint.metadata,
      definition: {
        ...extensionPoint.definition,
        reader: readerTypeHack(extensionPoint.definition.reader),
        isAvailable: selectIsAvailable(extensionPoint),
      },
    },
  };
}

function asDynamicElement(element: ActionFormState): ButtonDefinition {
  return {
    type: "menuItem",
    extension: selectExtension(element, { includeInstanceIds: true }),
    extensionPointConfig: selectExtensionPointConfig(element),
  };
}

const config: ElementConfig<ButtonSelectionResult, ActionFormState> = {
  displayOrder: 0,
  elementType: "menuItem",
  label: "Button",
  icon: faMousePointer,
  baseClass: MenuItemExtensionPoint,
  EditorNode: MenuItemConfiguration,
  selectNativeElement: insertButton,
  fromNativeElement,
  asDynamicElement,
  selectExtensionPointConfig,
  selectExtension,
  fromExtension,
};

export default config;
