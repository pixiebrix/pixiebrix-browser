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

import { type StandaloneModDefinition } from "@/types/contract";
import { type IntegrationDependency } from "@/types/serviceTypes";
import { type PermissionsStatus } from "@/permissions/permissionsTypes";
import { resolveExtensionInnerDefinitions } from "@/registry/internal";
import { type ResolvedModComponentDefinition } from "@/types/modDefinitionTypes";
import { checkRecipePermissions } from "@/recipes/recipePermissionsHelpers";

// Separate from extensionPermissionsHelpers.ts to avoid a circular dependency with recipePermissionsHelpers.ts

/**
 * Return permissions status for a StandaloneModDefinition and the user's selected dependencies
 * @param extension the StandaloneModDefinition
 * @param services the selected integration configurations
 */
export async function checkCloudExtensionPermissions(
  extension: StandaloneModDefinition,
  services: IntegrationDependency[]
): Promise<PermissionsStatus> {
  const resolved = await resolveExtensionInnerDefinitions({
    ...extension,
    services,
  });

  const configured = services.filter((x) => x.config);

  const recipeLike = {
    definitions: {},
    extensionPoints: [
      {
        id: resolved.extensionPointId,
        config: resolved.config,
        services: Object.fromEntries(
          services.map((service) => [service.outputKey, service.id])
        ),
      } as ResolvedModComponentDefinition,
    ],
  };

  return checkRecipePermissions(
    recipeLike,
    configured.map(({ id, config }) => ({ id, config }))
  );
}
