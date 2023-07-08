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

import type React from "react";
import { type IconProp } from "@fortawesome/fontawesome-svg-core";
import { type Metadata, type RegistryId } from "@/types/registryTypes";
import { type FrameworkMeta } from "@/pageScript/messenger/constants";
import {
  type ExtensionPointConfig,
  type ExtensionPointType,
} from "@/extensionPoints/types";
import {
  type BrickPipeline,
  type NormalizedAvailability,
} from "@/blocks/types";
import type { DynamicDefinition } from "@/contentScript/pageEditor/types";
import type { Permissions } from "webextension-polyfill";
import { type ApiVersion, type OptionsArgs } from "@/types/runtimeTypes";
import { type UUID } from "@/types/stringTypes";
import { type ServiceDependency } from "@/types/serviceTypes";
import { type IExtension } from "@/types/extensionTypes";
import { type OptionsDefinition } from "@/types/modDefinitionTypes";
import { type Target } from "@/types/messengerTypes";

/**
 * A simplified type for ReaderConfig to prevent TypeScript reporting problems with infinite type instantiation
 * @see ReaderConfig
 */
export type SingleLayerReaderConfig =
  | RegistryId
  | RegistryId[]
  | Record<string, RegistryId>;

export type BaseExtensionPointState = {
  metadata: Metadata;
  definition: {
    type: ExtensionPointType;
    // We're currently not allowing users to modify readers in the page editor
    reader: SingleLayerReaderConfig;
    isAvailable: NormalizedAvailability;
  };
};

export interface BaseExtensionState {
  blockPipeline: BrickPipeline;
}

export interface BaseFormState<
  TExtension extends BaseExtensionState = BaseExtensionState,
  TExtensionPoint extends BaseExtensionPointState = BaseExtensionPointState
> {
  /**
   * The apiVersion of the brick definition, controlling how PixieBrix interprets brick definitions
   * @see ApiVersion
   */
  readonly apiVersion: ApiVersion;

  /**
   * The extension uuid
   */
  readonly uuid: UUID;

  /**
   * The type of the extensionPoint
   */
  readonly type: ExtensionPointType;

  /**
   * True if the extensionPoint exists in in the registry
   */
  installed?: boolean;

  /**
   * True if the extension should be allowed to auto-reload. In general, only extensions that require user
   * interaction to trigger should be allowed to auto-reload. Otherwise, PixieBrix might end up spamming an API
   */
  autoReload?: boolean;

  /**
   * User-provided name to identify the extension
   */
  label: string;

  /**
   * The input options from the extension's blueprint
   * @since 1.4.3
   */
  optionsArgs: OptionsArgs;

  services: ServiceDependency[];

  /**
   * The extra permissions required by the extension
   * @since 1.7.0
   */
  permissions: Permissions.Permissions;

  extensionPoint: TExtensionPoint;

  extension: TExtension;

  /**
   * Information about the recipe (i.e., blueprint) used to install the extension, or `undefined` if the extension
   * is not part of a recipe.
   * @see IExtension._recipe
   */
  recipe: IExtension["_recipe"] | undefined;

  /**
   * Information about the recipe (i.e., blueprint) options,
   * or `undefined` if the extension is not part of a recipe.
   * @see RecipeDefinition.options
   */
  optionsDefinition?: OptionsDefinition;
}

/**
 * ExtensionPoint configuration for use with the Page Editor.
 */
export interface ElementConfig<
  TResult = unknown,
  TState extends BaseFormState = BaseFormState
> {
  /**
   * The internal element type, e.g., menuItem, contextMenu, etc.
   */
  readonly elementType: ExtensionPointType;

  /**
   * The ExtensionPointConfig class corresponding to the extension point
   * @see ExtensionPointConfig
   */
  // eslint-disable-next-line @typescript-eslint/ban-types -- we want to Ctor here for the extension point
  readonly baseClass: Function;

  readonly EditorNode?: React.ComponentType<{ isLocked: boolean }>;

  /**
   * Order to display this element in the new element dropdown in the sidebar
   */
  readonly displayOrder: number;

  /**
   * The human-friendly name to refer to the element type (e.g., Context Menu)
   */
  readonly label: string;

  /**
   * FontAwesome icon representing the element type
   */
  readonly icon: IconProp;

  /**
   * Feature flag that indicates whether the element type is enabled for the user. `undefined` to indicate
   * all users should be able to create/edit the elements of this type.
   */
  readonly flag?: string;

  /**
   * Method for the user to select an element from the host page (e.g., placing a menu button).
   * `undefined` for elements that aren't placed natively in the host page (e.g., context menus)
   * @param target the tab on which to run the function
   */
  readonly selectNativeElement?: (
    target: Target,
    useNewFilter?: boolean
  ) => Promise<TResult>;

  /**
   * Returns the initial page editor form state for a new element (including new foundation)
   * @param url the URL of the current page
   * @param metadata the initial metadata for the new element
   * @param element the result of the `insert` method
   * @param frameworks the frameworks that PixieBrix has detected on the host page
   *
   * @see fromExtensionPoint
   */
  readonly fromNativeElement: (
    url: string,
    metadata: Metadata,
    element: TResult,
    frameworks?: FrameworkMeta[]
  ) => TState;

  /**
   * Returns a dynamic element definition that the content script can render on the page
   */
  readonly asDynamicElement: (state: TState) => DynamicDefinition;

  /**
   * Returns the FormState corresponding to extension
   */
  readonly fromExtension: (extension: IExtension) => Promise<TState>;

  /**
   * Returns the extension point configuration corresponding to the FormState.
   */
  readonly selectExtensionPointConfig: (
    element: TState
  ) => ExtensionPointConfig;

  /**
   * Returns the extension configuration corresponding to the FormState.
   *
   * NOTE: If the extension uses an innerDefinition for the extension point, the extensionPointId will point to the
   * temporary `@inner/` RegistryId generated by the Page Editor.
   *
   * @see isInnerExtensionPoint
   * @see extensionWithInnerDefinitions
   */
  readonly selectExtension: (element: TState) => IExtension;
}
