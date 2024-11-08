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

import { type UiSchema } from "@rjsf/utils";
import {
  type Definition,
  type InnerDefinitionRef,
  type InnerDefinitions,
  type DefinitionKinds,
  type RegistryId,
  type VersionedMetadata,
} from "./registryTypes";
import { type Schema } from "./schemaTypes";
import { type Timestamp, type UUID } from "./stringTypes";
import { type Permissions } from "webextension-polyfill";
import { type OutputKey, type TemplateEngine } from "./runtimeTypes";

/**
 * A section defining which options are available during mod activation
 * @see ModDefinition.options
 */
export type ModOptionsDefinition = {
  schema: Schema;
  uiSchema?: UiSchema;
};

/**
 * A section declaring mod variables that can be used in the mod's components.
 *
 * Introduced to support:
 * - Attaching descriptions and types to mod variables
 * - Mod variable synchronization policy
 *
 * @see ModDefinition.variables
 * @since 2.1.2
 */
export type ModVariablesDefinition = {
  // Nest schema to make evolution easier in the future. Mod Variables shouldn't ever need a uiSchema because the values
  // are not user-facing/configurable.
  /**
   * JSON Schema for the mod variables. The top-level schema must be an object schema.
   *
   * Note that object schemas allow additional properties by default, so an empty object schema is backward compatible
   * with existing mod definitions.
   */
  schema: Schema;
};

/**
 * A ModComponent defined in a mod.
 * @see ModDefinition.extensionPoints
 */
export type ModComponentDefinition = {
  /**
   * The id of the StarterBrick.
   */
  id: RegistryId | InnerDefinitionRef;

  /**
   * Human-readable name for the ModComponent to display in the UI.
   */
  label: string;

  /**
   * Additional permissions required by the configured ModComponent. This section will generally be missing/blank unless
   * the permissions need to be declared to account for dynamic URLs accessed by the ModComponent.
   */
  permissions?: Permissions.Permissions;

  /**
   * Services to make available to the ModComponent. During activation, the user will be prompted to select a credential
   * for each service entry.
   */
  services?: Record<OutputKey, RegistryId> | Schema;

  /**
   * The default template engine for the ModComponent.
   * @deprecated in apiVersion v3 the expression engine is controlled explicitly
   */
  templateEngine?: TemplateEngine;

  /**
   * The ModComponent configuration.
   */
  config: UnknownObject;
};

/**
 * An ModComponentDefinition with all inner definition references hydrated.
 * @see hydrateModInnerDefinitions
 */
export type HydratedModComponentDefinition = ModComponentDefinition & {
  // Known to be a registry id instead of an InnerDefinitionRef
  id: RegistryId;

  _hydratedModComponentDefinitionBrand: never;
};

/**
 * A version of ModDefinition without the metadata properties that should not be included with the submitted
 * YAML/JSON config for the mod.
 *
 * When creating a mod definition locally, this is probably what you want.
 *
 * @see ModDefinition
 * @see PackageUpsertResponse
 */
export interface UnsavedModDefinition extends Definition {
  kind: typeof DefinitionKinds.MOD;
  // Strengthen Metadata.version to be required
  metadata: VersionedMetadata;
  extensionPoints: ModComponentDefinition[];
  definitions?: InnerDefinitions;
  options?: ModOptionsDefinition;
  variables?: ModVariablesDefinition;
}

/**
 * Information about whom a package has been shared with. Currently used only on mods in the interface to indicate
 * which team they were shared from
 */
// Not exported -- use ModDefinition["sharing"] instead to reference
type SharingDefinition = {
  /**
   * True fi the package has been shared publicly on PixieBrix
   */
  public: boolean;
  /**
   * Organizations the package has been shared with. Only includes the organizations that are visible to the user.
   */
  organizations: UUID[];
};

/**
 * Config of a Package returned from the PixieBrix API. Used to activate ModComponents.
 *
 * If you are creating a mod definition locally, you probably want UnsavedModDefinition, which doesn't include
 * the `sharing` and `updated_at` fields which aren't stored on the YAML/JSON, but are added by the server on responses.
 *
 * There is no auto-generated swagger Type for this because config is saved in a single JSON field on the server.
 *
 * @see UnsavedModDefinition
 */
export interface ModDefinition extends UnsavedModDefinition {
  /**
   * Who the mod is shared with. NOTE: does not appear in the mod's YAML/JSON config -- the API endpoint's
   * serializer adds it to the response.
   */
  sharing: SharingDefinition;

  /**
   * When the mod was last updated. Can be used to detect updates where the version number of the mod was
   * not bumped. NOTE: does not appear in the mod's YAML/JSON config -- the API endpoint's
   * serializer adds it to the response.
   */
  updated_at: Timestamp;
}
