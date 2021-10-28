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

/**
 * Type contract between the backend and front-end.
 */
import { RecipeDefinition } from "@/types/definitions";
import {
  ServiceConfig,
  SanitizedConfig,
  Metadata,
  UUID,
  Config,
  EmptyConfig,
  PersistedExtension,
} from "@/core";

import { components } from "@/types/swagger";
import { Except } from "type-fest";
import { FortAwesomeLibrary } from "@/components/AsyncIcon";

export type Kind = "block" | "foundation" | "service" | "blueprint" | "reader";

export type Invitation = components["schemas"]["Invitation"];

export enum UserRole {
  member = 1,
  admin = 2,
  developer = 3,
  restricted = 4,
}

export type Organization = components["schemas"]["Organization"] & {
  // The `role` property is added in the Redux RTK definition for getOrganizations (see api.ts)
  // WARNING: currently this role is only accurate for Admin. All other users are passed as Restricted even if they have
  // a Member or Developer role on the team
  role: UserRole;
};

export type Group = components["schemas"]["Group"];

export type Database = components["schemas"]["Database"];

export type PackageVersion = components["schemas"]["PackageVersion"];

export type Package = components["schemas"]["Package"];

export type SanitizedAuth = components["schemas"]["SanitizedAuth"] & {
  // XXX: update serialize to required id in response type
  id: UUID;
  // Specialized to `SanitizedConfig` to get nominal typing
  config: SanitizedConfig;
  // XXX: update serializer to include proper metadata child serializer
  service: { config: { metadata: Metadata } };
};

export type ConfigurableAuth = components["schemas"]["EditableAuth"] & {
  // Specialized to `ServiceConfig` to get nominal typing
  config: ServiceConfig;
};

export type Deployment = components["schemas"]["DeploymentDetail"] & {
  id: UUID;
  package: { config: RecipeDefinition };
};

export type Brick = components["schemas"]["PackageMeta"] & {
  kind: Kind;
};

export type RegistryPackage = Pick<
  components["schemas"]["PackageConfigList"],
  "kind" | "metadata"
> & {
  // XXX: update serializer to include proper child serializer
  metadata: Metadata;
  kind: Kind;
};

/**
 * A personal user extension synced/saved to the cloud.
 */
export type CloudExtension<T extends Config = EmptyConfig> = Except<
  PersistedExtension<T>,
  "active"
> & {
  _remoteUserExtensionBrand: never;
  _deployment: undefined;
  _recipe: undefined;
};

/**
 * Detailed MarketplaceListing
 * TODO: generate type using swagger
 */
export type MarketplaceListing = {
  id: string;
  package: Record<string, unknown>;
  fa_icon: `${FortAwesomeLibrary} ${string}`;
  icon_color: string;
  image?: {
    url: string;
    alt_text: string;
  };
};
