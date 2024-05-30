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

import {
  type ModComponentDefinition,
  type ModDefinition,
} from "@/types/modDefinitionTypes";
import { type StarterBrickDefinition } from "@/starterBricks/types";
import { type StarterBrickType } from "@/types/starterBrickTypes";
import starterBrickRegistry from "@/starterBricks/registry";
import { type RegistryId } from "@/types/registryTypes";
import { compact, uniq } from "lodash";
import { resolveRecipeInnerDefinitions } from "@/registry/internal";
import { QuickBarStarterBrickABC } from "@/starterBricks/quickBar/quickBarExtension";
import { QuickBarProviderStarterBrickABC } from "@/starterBricks/quickBarProvider/quickBarProviderExtension";
import { type ActivatedModComponent } from "@/types/modComponentTypes";
import { type UUID } from "@/types/stringTypes";

async function getStarterBrickType(
  modComponentDefinition: ModComponentDefinition,
  modDefinition: ModDefinition,
): Promise<StarterBrickType | null> {
  // Look up the extension point in recipe inner definitions first
  if (modDefinition.definitions?.[modComponentDefinition.id]) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion -- checked above
    const definition: StarterBrickDefinition = modDefinition.definitions[
      modComponentDefinition.id
    ]!.definition as StarterBrickDefinition;
    const extensionPointType = definition?.type;

    if (extensionPointType) {
      return extensionPointType;
    }
  }

  // If no inner definitions, look up the extension point in the registry
  const extensionPointFromRegistry = await starterBrickRegistry.lookup(
    modComponentDefinition.id as RegistryId,
  );

  return extensionPointFromRegistry?.kind ?? null;
}

export function getAllModComponentDefinitionsWithType(
  modDefinition: ModDefinition,
  type: StarterBrickType,
): ModComponentDefinition[] {
  return modDefinition.extensionPoints.filter((extensionPoint) => {
    const definition: StarterBrickDefinition = modDefinition.definitions?.[
      extensionPoint.id
    ]?.definition as StarterBrickDefinition;
    return definition?.type === type;
  });
}

export async function getContainedStarterBrickTypes(
  modDefinition: ModDefinition,
): Promise<StarterBrickType[]> {
  const extensionPointTypes = await Promise.all(
    modDefinition.extensionPoints.map(async (extensionPoint) =>
      getStarterBrickType(extensionPoint, modDefinition),
    ),
  );

  return uniq(compact(extensionPointTypes));
}

/**
 * Returns true if the recipe includes a static or dynamic Quick Bar entries.
 */
export async function includesQuickBarStarterBrick(
  modDefinition?: ModDefinition,
): Promise<boolean> {
  const resolvedExtensionDefinitions =
    (await resolveRecipeInnerDefinitions(modDefinition)) ?? [];

  for (const { id } of resolvedExtensionDefinitions) {
    // eslint-disable-next-line no-await-in-loop -- can break when we find one
    const starterBrick = await starterBrickRegistry.lookup(id);
    if (
      QuickBarStarterBrickABC.isQuickBarExtensionPoint(starterBrick) ||
      QuickBarProviderStarterBrickABC.isQuickBarProviderExtensionPoint(
        starterBrick,
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Find the activated mod components for a subset of Mod Component Definitions
 * and return their ids.
 */
export function getModComponentIdsForModComponentDefinitions(
  activatedModComponents: ActivatedModComponent[],
  modComponentDefinitions: ModComponentDefinition[],
): UUID[] {
  return modComponentDefinitions
    .map((modComponentDefinition) => {
      const activatedModComponent = activatedModComponents.find(
        (activatedModComponent) =>
          activatedModComponent.extensionPointId === modComponentDefinition.id,
      );
      return activatedModComponent?.id;
    })
    .filter(Boolean);
}
