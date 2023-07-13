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

import extensionPointRegistry from "@/extensionPoints/registry";
import { QuickBarStarterBrickABC } from "@/extensionPoints/quickBarExtension";
import { QuickBarProviderStarterBrickABC } from "@/extensionPoints/quickBarProviderExtension";
import { type ModDefinition } from "@/types/modDefinitionTypes";
import { resolveRecipeInnerDefinitions } from "@/registry/internal";

/**
 * Returns true if the recipe includes a static or dynamic Quick Bar entries.
 * @param recipe the recipe definition
 */
export default async function includesQuickBarExtensionPoint(
  recipe?: ModDefinition
): Promise<boolean> {
  const resolvedExtensionDefinitions = await resolveRecipeInnerDefinitions(
    recipe
  );

  for (const { id } of resolvedExtensionDefinitions) {
    // eslint-disable-next-line no-await-in-loop -- can break when we find one
    const extensionPoint = await extensionPointRegistry.lookup(id);
    if (
      QuickBarStarterBrickABC.isQuickBarExtensionPoint(extensionPoint) ||
      QuickBarProviderStarterBrickABC.isQuickBarProviderExtensionPoint(
        extensionPoint
      )
    ) {
      return true;
    }
  }

  return false;
}
