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

import { compact, flatten, groupBy, uniq, uniqBy } from "lodash";
import { PIXIEBRIX_INTEGRATION_ID } from "@/services/constants";
import { type ModComponentBase } from "@/types/modComponentTypes";
import { type OptionsArgs } from "@/types/runtimeTypes";
import { type RegistryId } from "@/types/registryTypes";
import { type UUID } from "@/types/stringTypes";
import { type ModComponentFormState } from "@/pageEditor/starterBricks/formStateTypes";
import { type IntegrationDependency } from "@/types/integrationTypes";

/**
 * Infer options from existing extension-like instances for reinstalling a recipe
 * @see installRecipe
 */
export function inferRecipeOptions(
  extensions: Array<Pick<ModComponentBase, "optionsArgs">>
): OptionsArgs {
  // For a given recipe, all the extensions receive the same options during the install process (even if they don't
  // use the options), so we can just take the optionsArgs for any of the extensions
  return extensions[0]?.optionsArgs ?? {};
}

/**
 * Infer service configurations from existing extension-like instances for reinstalling a recipe
 * @see installRecipe
 */
export function inferRecipeAuths(
  extensions: Array<Pick<ModComponentBase, "services">>,
  { optional = false }: { optional?: boolean } = {}
): Record<RegistryId, UUID> {
  // The extensions for the recipe will only have the services that are declared on each extension. So we have to take
  // the union of the service credentials. There's currently no way in the UX that the service auths could become
  // inconsistent for a given service key, but guard against that case anyway.

  const serviceAuths = groupBy(
    extensions.flatMap((x) => x.services ?? []),
    (x) => x.id
  );
  const result: Record<RegistryId, UUID> = {};
  for (const [id, auths] of Object.entries(serviceAuths)) {
    const configs = uniq(compact(auths.map(({ config }) => config)));
    if (id !== PIXIEBRIX_INTEGRATION_ID && configs.length === 0 && !optional) {
      // PIXIEBRIX_SERVICE_ID gets the implicit configuration
      throw new Error(`Service ${id} is not configured`);
    }

    // If optional is passed in, we know that the user is being given an opportunity to switch which config is applied,
    // so the user can always switch to a different configuration if they want.
    if (configs.length > 1 && !optional) {
      throw new Error(`Service ${id} has multiple configurations`);
    }

    result[id as RegistryId] = configs[0];
  }

  return result;
}

/**
 * Infer all unique integration dependencies for a recipe
 */
export function inferRecipeDependencies(
  installedRecipeExtensions: ModComponentBase[],
  dirtyRecipeElements: ModComponentFormState[]
): IntegrationDependency[] {
  const withServices: Array<{ services?: IntegrationDependency[] }> = [
    ...installedRecipeExtensions,
    ...dirtyRecipeElements,
  ];
  return uniqBy(
    flatten(withServices.map(({ services }) => services ?? [])),
    JSON.stringify
  );
}
