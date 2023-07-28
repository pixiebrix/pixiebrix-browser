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

import { type BrickIcon } from "@/types/iconTypes";
import { type UUID } from "@/types/stringTypes";
import { type ApiVersion } from "@/types/runtimeTypes";
import { type UnknownObject } from "@/types/objectTypes";

/**
 * A brick registry id conforming to `@scope/collection/name`
 */
export type RegistryId = string & {
  // Nominal subtyping
  _registryIdBrand: never;
};

/**
 * Scope for inner definitions
 */
export const INNER_SCOPE = "@internal";

/**
 * The kind of definition in the external registry
 */
export type Kind =
  | "recipe"
  | "service"
  | "reader"
  | "component"
  | "extensionPoint";

/**
 * Simple semantic version number, major.minor.patch
 */
export type SemVerString = string & {
  _semVerBrand: never;
};

/**
 * Metadata about a Brick, StarterBrick, Integration, or Mod.
 */
export interface Metadata {
  /**
   * Registry id in the external registry
   */
  readonly id: RegistryId;

  /**
   * Human-readable name
   */
  readonly name: string;

  readonly description?: string;

  // Currently optional because it defaults to the browser extension version for bricks defined in JS
  readonly version?: SemVerString;

  /**
   * @deprecated experimental prop that will likely be removed in the future
   */
  readonly icon?: BrickIcon;

  /**
   * PixieBrix extension version required to install the brick/run the ModComponent
   * @since 1.4.0
   */
  // FIXME: this type is wrong. In practice, the value should be a semantic version range, e.g., >=1.4.0
  readonly extensionVersion?: SemVerString;
}

/**
 * NOTE: the sharing definition is not part of the definition the user writes. But the backend adds it before sending
 * the definition to the frontend.
 */
export type Sharing = {
  /**
   * True if the registry package is public
   */
  readonly public: boolean;
  /**
   * The UUIDs of the organizations that have access to the package. (And are visible to the user.)
   */
  readonly organizations: UUID[];
};

/**
 * A definition in the PixieBrix registry
 */
export interface Definition<K extends Kind = Kind> {
  apiVersion: ApiVersion;
  kind: K;
  metadata: Metadata;
}

/**
 * The inner definitions section of a definition.
 */
export type InnerDefinitions = Record<string, UnknownObject>;

/**
 * A reference to an entry in the recipe's `definitions` map. _Not a valid RegistryId_.
 * @see InnerDefinitions
 */
export type InnerDefinitionRef = string & {
  // Nominal subtyping
  _innerDefinitionRefBrand: never;
};
