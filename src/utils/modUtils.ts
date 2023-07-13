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

import { type ModDefinition } from "@/types/modDefinitionTypes";
import * as semver from "semver";
import { type MarketplaceListing, type Organization } from "@/types/contract";
import {
  type Mod,
  type ModViewItem,
  type SharingSource,
  type SharingType,
  type UnavailableMod,
} from "@/types/modTypes";
import { createSelector } from "reselect";
import { selectExtensions } from "@/store/extensionsSelectors";
import {
  type ModComponentBase,
  type ResolvedExtension,
  type UnresolvedExtension,
} from "@/types/extensionTypes";
import { type RegistryId } from "@/types/registryTypes";
import { type UUID } from "@/types/stringTypes";
import { type StarterBrickType } from "@/extensionPoints/types";
import extensionPointRegistry from "@/extensionPoints/registry";
import { getContainedExtensionPointTypes } from "@/utils/recipeUtils";

/**
 * Returns true if the mod is an UnavailableMod
 * @param mod the mod
 * @see UnavailableMod
 */
export function isUnavailableMod(mod: Mod): mod is UnavailableMod {
  return "isStub" in mod && mod.isStub;
}

/**
 * Returns true if the mod is a ResolvedExtension, instead of a mod definition.
 * @param mod the mod
 */
export function isExtension(mod: Mod): mod is ResolvedExtension {
  return "extensionPointId" in mod;
}

/**
 * Return true if the mod is an ModComponentBase that originated from a recipe.
 * @param mod the mod
 */
export function isExtensionFromRecipe(mod: Mod): boolean {
  return isExtension(mod) && Boolean(mod._recipe);
}

/**
 * Return true if the mod is a ModDefinition or UnavailableMod
 * @param mod the mod
 */
export function isModDefinition(
  mod: Mod
): mod is ModDefinition | UnavailableMod {
  return !isExtension(mod);
}

/**
 * Returns a unique id for the mod. Suitable for use as a React key
 * @param mod the mod
 */
export function getUniqueId(mod: Mod): UUID | RegistryId {
  return isExtension(mod) ? mod.id : mod.metadata.id;
}

/**
 * Returns the human-readable label for the mod
 * @param mod the mod
 */
export function getLabel(mod: Mod): string {
  return isExtension(mod) ? mod.label : mod.metadata.name;
}

/**
 * Returns the description for the mod
 * @param mod the mod
 */
export const getDescription = (mod: Mod): string => {
  const description = isExtension(mod)
    ? mod._recipe?.description
    : mod.metadata.description;

  if (!description && isExtension(mod)) {
    return "Created in the Page Editor";
  }

  return description;
};

/**
 * Return the registry id associated with a mod, or null
 * @param mod the mod
 */
export function getPackageId(mod: Mod): RegistryId | null {
  return isExtension(mod) ? mod._recipe?.id : mod.metadata.id;
}

/**
 * Returns the timestamp for the time the mod was last updated (edited)
 * @param mod the mod
 */
export function getUpdatedAt(mod: Mod): string | null {
  return isExtension(mod)
    ? // @ts-expect-error -- TODO: need to figure out why updateTimestamp isn't included on ModComponentBase here
      mod._recipe?.updated_at ?? mod.updateTimestamp
    : mod.updated_at;
}

function isPublic(mod: Mod): boolean {
  return isExtension(mod) ? mod._recipe?.sharing?.public : mod.sharing.public;
}

function isPersonalExtension(extension: ModComponentBase): boolean {
  return !extension._recipe && !extension._deployment;
}

function hasSourceRecipeWithScope(
  extension: ModComponentBase,
  scope: string
): boolean {
  return scope && extension._recipe?.id.startsWith(scope + "/");
}

function hasRecipeScope(recipe: ModDefinition | UnavailableMod, scope: string) {
  return Boolean(recipe.metadata?.id.startsWith(scope + "/"));
}

/**
 * Returns true if the user directly owns the mod
 * @param mod the mod
 * @param userScope the user's scope, or null if it's not set
 */
function isPersonal(mod: Mod, userScope: string | null) {
  if (isExtension(mod)) {
    return isPersonalExtension(mod) || hasSourceRecipeWithScope(mod, userScope);
  }

  return hasRecipeScope(mod, userScope);
}

export function getInstalledVersionNumber(
  installedExtensions: UnresolvedExtension[],
  mod: Mod
): string | null {
  if (isExtension(mod)) {
    return mod._recipe?.version;
  }

  const installedExtension = installedExtensions.find(
    (extension: UnresolvedExtension) =>
      extension._recipe?.id === mod.metadata.id
  );

  return installedExtension?._recipe?.version;
}

export function isDeployment(
  mod: Mod,
  installedExtensions: UnresolvedExtension[]
): boolean {
  if (isExtension(mod)) {
    return Boolean(mod._deployment);
  }

  const recipeId = mod.metadata.id;
  return installedExtensions.some(
    (installedExtension) =>
      installedExtension._recipe?.id === recipeId &&
      installedExtension?._deployment
  );
}

/**
 * Returns true if a Blueprint has been made public but is not yet published to the Marketplace.
 */
export function isRecipePendingPublish(
  recipe: ModDefinition,
  marketplaceListings: Record<RegistryId, MarketplaceListing>
): boolean {
  return recipe.sharing.public && !marketplaceListings[recipe.metadata.id];
}

export function getSharingType({
  mod,
  organizations,
  scope,
  installedExtensions,
}: {
  mod: Mod;
  organizations: Organization[];
  scope: string;
  installedExtensions: UnresolvedExtension[];
}): SharingSource {
  let sharingType: SharingType = null;
  const organization = getOrganization(mod, organizations);

  if (isPersonal(mod, scope)) {
    sharingType = "Personal";
  } else if (isDeployment(mod, installedExtensions)) {
    sharingType = "Deployment";
  } else if (organization) {
    sharingType = "Team";
  } else if (isPublic(mod)) {
    sharingType = "Public";
  }

  let label: string;
  if (
    sharingType === "Team" ||
    // There's a corner case for team deployments of public market bricks. The organization will come through as
    // nullish here.
    (sharingType === "Deployment" && organization?.name)
  ) {
    label = organization.name;
  } else {
    label = sharingType;
  }

  return {
    type: sharingType,
    label,
    organization,
  };
}

export function updateAvailable(
  availableRecipes: Map<RegistryId, ModDefinition>,
  installedExtensions: Map<RegistryId, UnresolvedExtension>,
  mod: Mod
): boolean {
  if (isUnavailableMod(mod)) {
    // Unavailable mods are never update-able
    return false;
  }

  const installedExtension: ResolvedExtension | UnresolvedExtension =
    isModDefinition(mod) ? installedExtensions.get(mod.metadata.id) : mod;

  if (!installedExtension?._recipe) {
    return false;
  }

  const availableRecipe = availableRecipes.get(installedExtension._recipe.id);

  if (!availableRecipe) {
    return false;
  }

  if (
    semver.gt(
      availableRecipe.metadata.version,
      installedExtension._recipe.version
    )
  ) {
    return true;
  }

  if (
    semver.eq(
      availableRecipe.metadata.version,
      installedExtension._recipe.version
    )
  ) {
    // Check the updated_at timestamp
    if (installedExtension._recipe?.updated_at == null) {
      // Extension was installed prior to us adding updated_at to RecipeMetadata
      return false;
    }

    const availableDate = new Date(availableRecipe.updated_at);
    const installedDate = new Date(installedExtension._recipe.updated_at);

    return availableDate > installedDate;
  }

  return false;
}

function getOrganization(
  mod: Mod,
  organizations: Organization[]
): Organization {
  const sharing = isExtension(mod) ? mod._recipe?.sharing : mod.sharing;

  if (!sharing || sharing.organizations.length === 0) {
    return null;
  }

  // If more than one sharing organization, use the first.
  // This is an uncommon scenario.
  return organizations.find((org) =>
    sharing.organizations.includes(org.id as UUID)
  );
}

/**
 * Select UnresolvedExtensions currently installed from the mod.
 */
export const selectExtensionsFromMod = createSelector(
  [selectExtensions, (state: unknown, mod: Mod) => mod],
  (installedExtensions, mod) =>
    isModDefinition(mod)
      ? installedExtensions.filter(
          (extension) => extension._recipe?.id === mod.metadata.id
        )
      : installedExtensions.filter((x) => x.id === mod.id)
);

export const StarterBrickMap: Record<StarterBrickType, string> = {
  panel: "Sidebar Panel",
  menuItem: "Button",
  trigger: "Trigger",
  contextMenu: "Context Menu",
  actionPanel: "Sidebar",
  quickBar: "Quick Bar Action",
  quickBarProvider: "Dynamic Quick Bar",
  tour: "Tour",
};

const getExtensionPointType = async (
  extension: ResolvedExtension
): Promise<StarterBrickType> => {
  const extensionPoint = await extensionPointRegistry.lookup(
    extension.extensionPointId
  );

  return extensionPoint.kind as StarterBrickType;
};

const getExtensionPointTypesContained = async (
  modViewItem: ModViewItem
): Promise<StarterBrickType[]> => {
  if (isUnavailableMod(modViewItem.mod)) {
    return [];
  }

  return isModDefinition(modViewItem.mod)
    ? getContainedExtensionPointTypes(modViewItem.mod)
    : [await getExtensionPointType(modViewItem.mod)];
};

export const getContainedStarterBrickNames = async (
  modViewItem: ModViewItem
): Promise<string[]> => {
  const extensionPointTypes = await getExtensionPointTypesContained(
    modViewItem
  );
  const starterBricksContained = [];
  for (const extensionPointType of extensionPointTypes) {
    // eslint-disable-next-line security/detect-object-injection -- extensionPointType is type ExtensionPointType
    const starterBrick = StarterBrickMap[extensionPointType];
    if (starterBrick) {
      starterBricksContained.push(starterBrick);
    }
  }

  return starterBricksContained;
};
