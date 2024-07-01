/*
 * Copyright (C) 2024 PixieBrix, Inc.
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

import { type Except } from "type-fest";
import {
  type IntegrationDependency,
  type IntegrationDependencyV1,
  type IntegrationDependencyV2,
} from "@/integrations/integrationTypes";
import { type ApiVersion, type OptionsArgs } from "@/types/runtimeTypes";
import { type UUID } from "@/types/stringTypes";
import { type StarterBrickType } from "@/types/starterBrickTypes";
import { type Permissions } from "webextension-polyfill";
import { type ModComponentBase } from "@/types/modComponentTypes";
import { type ModOptionsDefinition } from "@/types/modDefinitionTypes";
import { type BrickPipeline } from "@/bricks/types";
import { type Metadata, type RegistryId } from "@/types/registryTypes";
import { type NormalizedAvailability } from "@/types/availabilityTypes";

/**
 * A simplified type for ReaderConfig to prevent TypeScript reporting problems with infinite type instantiation
 * @see ReaderConfig
 */
export type SingleLayerReaderConfig =
  | RegistryId
  | RegistryId[]
  | Record<string, RegistryId>;

export type BaseStarterBrickState = {
  metadata: Metadata;
  definition: {
    type: StarterBrickType;
    // We're currently not allowing users to modify readers in the page editor
    reader: SingleLayerReaderConfig;
    isAvailable: NormalizedAvailability;
  };
};

export interface BaseModComponentState {
  blockPipeline: BrickPipeline;
}

/**
 * @deprecated - Do not use versioned state types directly
 */
export interface BaseFormStateV1<
  TModComponent extends BaseModComponentState = BaseModComponentState,
  TStarterBrick extends BaseStarterBrickState = BaseStarterBrickState,
> {
  /**
   * The apiVersion of the brick definition, controlling how PixieBrix interprets brick definitions
   * @see ApiVersion
   */
  readonly apiVersion: ApiVersion;

  /**
   * The mod component uuid
   */
  readonly uuid: UUID;

  /**
   * The type of the starter brick
   */
  readonly type: StarterBrickType;

  /**
   * True if the starter brick exists in the registry
   */
  installed?: boolean;

  /**
   * True if the mod component should be allowed to auto-reload. In general, only mod components that require user
   * interaction to trigger should be allowed to auto-reload. Otherwise, PixieBrix might end up spamming an API
   */
  autoReload?: boolean;

  /**
   * User-provided name to identify the mod component
   */
  label: string;

  /**
   * The input options from the mod component's mod
   * @since 1.4.3
   */
  optionsArgs: OptionsArgs;

  services: IntegrationDependencyV1[];

  /**
   * The extra permissions required by the mod component
   * @since 1.7.0
   */
  permissions: Permissions.Permissions;

  extensionPoint: TStarterBrick;

  extension: TModComponent;

  /**
   * Information about the mod used to install the mod component, or `undefined`
   * if the mod component is not part of a mod.
   * @see ModComponentBase._recipe
   */
  recipe: ModComponentBase["_recipe"] | undefined;

  /**
   * Information about the mod options or `undefined`
   * if the mod component is not part of a mod.
   * @see ModDefinition.options
   */
  optionsDefinition?: ModOptionsDefinition;
}

/**
 * @deprecated - Do not use versioned state types directly
 */
export type BaseFormStateV2<
  TModComponent extends BaseModComponentState = BaseModComponentState,
  TStarterBrick extends BaseStarterBrickState = BaseStarterBrickState,
> = Except<BaseFormStateV1<TModComponent, TStarterBrick>, "services"> & {
  /**
   * The integration dependencies configured for the mod component
   *
   * @since 1.7.41 renamed from `services` to `integrationDependencies`, also
   * changed from IntegrationDependencyV1 to IntegrationDependencyV2
   */
  integrationDependencies: IntegrationDependencyV2[];
};

/**
 * @deprecated - Do not use versioned state types directly
 */
export type BaseFormStateV3<
  TModComponent extends BaseModComponentState = BaseModComponentState,
  TStarterBrick extends BaseStarterBrickState = BaseStarterBrickState,
> = Except<
  BaseFormStateV2<TModComponent, TStarterBrick>,
  "recipe" | "extension" | "extensionPoint"
> & {
  /**
   * @since 2.0.5
   * Part of the Page Editor renaming effort
   * `extensionPoint` to `starterBrick`
   */
  starterBrick: TStarterBrick;

  /**
   * @since 2.0.5
   * Part of the Page Editor renaming effort
   * `extension` to `modComponent`
   */
  modComponent: TModComponent;

  /**
   * @since 2.0.5
   * Part of the Page Editor renaming effort
   * `recipe` to `modMetadata`
   * Information about the mod used to install the mod component, or `undefined`
   * if the mod component is not part of a mod.
   * @see ModComponentBase._recipe
   */
  modMetadata: ModComponentBase["_recipe"] | undefined;
};

export type BaseFormState<
  TModComponent extends BaseModComponentState = BaseModComponentState,
  TStarterBrick extends BaseStarterBrickState = BaseStarterBrickState,
> = Except<
  BaseFormStateV3<TModComponent, TStarterBrick>,
  "integrationDependencies"
> & {
  /**
   * Using the un-versioned type
   */
  integrationDependencies: IntegrationDependency[];
};
