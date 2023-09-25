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

import {
  type InnerDefinitionRef,
  type InnerDefinitions,
  type Metadata,
  type RegistryId,
} from "@/types/registryTypes";
import {
  isInnerDefinitionRegistryId,
  PACKAGE_REGEX,
  validateRegistryId,
} from "@/types/helpers";
import { compact, isEmpty, isEqual, pick, sortBy } from "lodash";
import { produce } from "immer";
import { ADAPTERS } from "@/pageEditor/starterBricks/adapter";
import { type ModComponentFormState } from "@/pageEditor/starterBricks/formStateTypes";
import {
  DEFAULT_EXTENSION_POINT_VAR,
  PAGE_EDITOR_DEFAULT_BRICK_API_VERSION,
} from "@/pageEditor/starterBricks/base";
import { type Except } from "type-fest";
import {
  type ModComponentDefinition,
  type ModDefinition,
  type ModOptionsDefinition,
  type UnsavedModDefinition,
} from "@/types/modDefinitionTypes";
import {
  type ModComponentBase,
  type UnresolvedModComponent,
} from "@/types/modComponentTypes";
import { type SafeString } from "@/types/stringTypes";
import { type ModMetadataFormState } from "@/pageEditor/pageEditorTypes";
import { type EditablePackageMetadata } from "@/types/contract";
import { freshIdentifier } from "@/utils/variableUtils";
import {
  type IntegrationDependency,
  type ModDependencyAPIVersion,
} from "@/types/integrationTypes";
import { type Schema } from "@/types/schemaTypes";
import { SERVICES_BASE_SCHEMA_URL } from "@/services/integrationUtils";

/**
 * Generate a new registry id from an existing registry id by adding/replacing the scope.
 * @param newScope the scope of the author including the "@" prefix (user scope or organization scope)
 * @param sourceId the current registry id
 */
export function generateScopeBrickId(
  newScope: string,
  sourceId: RegistryId
): RegistryId {
  const match = PACKAGE_REGEX.exec(sourceId);
  return validateRegistryId(
    compact([newScope, match.groups?.collection, match.groups?.name]).join("/")
  );
}

export function isRecipeEditable(
  editablePackages: EditablePackageMetadata[],
  recipe: ModDefinition
): boolean {
  // The user might lose access to the recipe while they were editing it (the recipe or an extension)
  // See https://github.com/pixiebrix/pixiebrix-extension/issues/2813
  const recipeId = recipe?.metadata?.id;
  return recipeId != null && editablePackages.some((x) => x.name === recipeId);
}

/**
 * Return the index of the extension in the recipe. Throws an error if a match isn't found.
 *
 * There are a couple corner cases in the recipe specification and version handling:
 * - A user modified the recipe in the workshop but didn't change the version number of the recipe
 * - Labels in a recipe aren't guaranteed to be unique. However, they generally will be in practice
 *
 * For now, we'll just handle the normal case and send people to the workshop for the corner cases.
 */
function findRecipeIndex(
  sourceRecipe: ModDefinition,
  extension: ModComponentBase
): number {
  if (sourceRecipe.metadata.version !== extension._recipe.version) {
    console.warn(
      "Extension was installed using a different version of the recipe",
      {
        recipeVersion: sourceRecipe.metadata.version,
        extensionVersion: extension._recipe.version,
      }
    );
  }

  // Labels in the recipe aren't guaranteed to be unique
  const labelMatches = sourceRecipe.extensionPoints.filter(
    (x) => x.label === extension.label
  );

  if (labelMatches.length === 0) {
    throw new Error(
      `There are no starter bricks in the mod with label "${extension.label}". You must edit the mod in the Workshop`
    );
  }

  if (labelMatches.length > 1) {
    throw new Error(
      `There are multiple starter bricks in the mod with label "${extension.label}". You must edit the mod in the Workshop`
    );
  }

  if (labelMatches.length === 1) {
    return sourceRecipe.extensionPoints.findIndex(
      (x) => x.label === extension.label
    );
  }
}

/**
 * Return the highest API Version used by any of the integrations in the mod. Only exported for testing.
 * @param integrationDependencies mod integration dependencies
 * @since 1.7.37
 * @note This function is just for safety, there's currently no way for a mod to end up with "mixed" integration api versions.
 */
export function findMaxIntegrationDependencyApiVersion(
  integrationDependencies: Array<Pick<IntegrationDependency, "apiVersion">>
): ModDependencyAPIVersion {
  let maxApiVersion: ModDependencyAPIVersion = "v1";
  for (const integrationDependency of integrationDependencies) {
    if (integrationDependency.apiVersion > maxApiVersion) {
      maxApiVersion = integrationDependency.apiVersion;
    }
  }

  return maxApiVersion;
}

export function selectExtensionPointIntegrations({
  integrationDependencies,
}: Pick<
  ModComponentBase,
  "integrationDependencies"
>): ModComponentDefinition["services"] {
  const apiVersion = findMaxIntegrationDependencyApiVersion(
    integrationDependencies
  );
  if (apiVersion === "v1") {
    return Object.fromEntries(
      integrationDependencies.map((x) => [x.outputKey, x.integrationId])
    );
  }

  if (apiVersion === "v2") {
    const properties: Record<string, Schema> = {};
    const required: string[] = [];
    for (const {
      outputKey,
      integrationId,
      isOptional,
    } of integrationDependencies) {
      properties[outputKey] = {
        $ref: `${SERVICES_BASE_SCHEMA_URL}${integrationId}`,
      };
      if (!isOptional) {
        required.push(outputKey);
      }
    }

    return {
      properties,
      required,
    } as Schema;
  }

  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- future-proofing
  throw new Error(`Unknown ModDependencyApiVersion: ${apiVersion}`);
}

/**
 * Create a copy of `sourceRecipe` with `metadata` and `element`.
 *
 * NOTE: the caller is responsible for updating an extensionPoint package (i.e., that has its own version). This method
 * only handles the extensionPoint if it's an inner definition
 *
 * @param sourceRecipe the original recipe
 * @param metadata the metadata for the new recipe
 * @param installedExtensions the user's locally installed extensions (i.e., from optionsSlice). Used to locate the
 * element's position in sourceRecipe
 * @param element the new extension state (i.e., submitted via Formik)
 */
export function replaceRecipeExtension(
  sourceRecipe: ModDefinition,
  metadata: Metadata,
  installedExtensions: ModComponentBase[],
  element: ModComponentFormState
): UnsavedModDefinition {
  const installedExtension = installedExtensions.find(
    (x) => x.id === element.uuid
  );

  if (installedExtension == null) {
    throw new Error(
      `Could not find local copy of starter brick: ${element.uuid}`
    );
  }

  return produce(sourceRecipe, (draft) => {
    draft.metadata = metadata;

    if (sourceRecipe.apiVersion !== element.apiVersion) {
      const canUpdateRecipeApiVersion =
        sourceRecipe.extensionPoints.length <= 1;
      if (canUpdateRecipeApiVersion) {
        draft.apiVersion = element.apiVersion;

        const extensionPointId = sourceRecipe.extensionPoints[0]?.id;
        // eslint-disable-next-line security/detect-object-injection -- getting a property by extension id
        const extensionPointDefinition = draft.definitions?.[extensionPointId];

        if (extensionPointDefinition?.apiVersion != null) {
          extensionPointDefinition.apiVersion = element.apiVersion;
        }
      } else {
        throw new Error(
          `Element's API Version (${element.apiVersion}) does not match mod's API Version (${sourceRecipe.apiVersion}) and mod's API Version cannot be updated`
        );
      }
    }

    if (isEmpty(element.optionsDefinition?.schema?.properties)) {
      draft.options = undefined;
    } else {
      draft.options = element.optionsDefinition;
    }

    const index = findRecipeIndex(sourceRecipe, installedExtension);

    const adapter = ADAPTERS.get(element.type);
    const rawExtension = adapter.selectExtension(element);
    const extensionPointId = element.extensionPoint.metadata.id;
    const hasInnerExtensionPoint =
      isInnerDefinitionRegistryId(extensionPointId);

    const commonExtensionConfig: Except<ModComponentDefinition, "id"> = {
      ...pick(rawExtension, [
        "label",
        "config",
        "permissions",
        "templateEngine",
      ]),
    };

    // The `services` field is optional, so only add it to the config if the raw
    // extension has a value. Normalizing here makes testing harder because we
    // then have to account for the normalized value in assertions.
    if (rawExtension.integrationDependencies) {
      commonExtensionConfig.services =
        selectExtensionPointIntegrations(rawExtension);
    }

    if (hasInnerExtensionPoint) {
      const extensionPointConfig = adapter.selectExtensionPointConfig(element);

      const originalInnerId = sourceRecipe.extensionPoints.at(index).id;
      let newInnerId = originalInnerId;

      if (
        sourceRecipe.extensionPoints.filter((x) => x.id === originalInnerId)
          .length > 1
      ) {
        // Multiple extensions share the same inner extension point definition. If the inner extension point definition
        // was modified, the behavior we want (at least for now) is to create new extensionPoint entry instead of
        // modifying the shared entry. If we wasn't modified, we don't have to make any changes.

        // NOTE: there are some non-functional changes (e.g., services being normalized from undefined to {}) that will
        // cause the definitions to not be equal. This is OK for now -- in practice it won't happen for blueprints
        // originally built using the Page Editor since it produces configs that include the explicit {} and [] objects
        // instead of undefined.
        if (
          !isEqual(
            // eslint-disable-next-line security/detect-object-injection -- existing id
            draft.definitions[originalInnerId].definition,
            extensionPointConfig.definition
          )
        ) {
          const freshId = freshIdentifier(
            "extensionPoint" as SafeString,
            Object.keys(sourceRecipe.definitions)
          ) as InnerDefinitionRef;
          newInnerId = freshId;
          // eslint-disable-next-line security/detect-object-injection -- generated with freshIdentifier
          draft.definitions[freshId] = {
            kind: "extensionPoint",
            definition: extensionPointConfig.definition,
          };
        }
      } else {
        // There's only one, can re-use without breaking the other definition
        // eslint-disable-next-line security/detect-object-injection -- existing id
        draft.definitions[originalInnerId] = {
          kind: "extensionPoint",
          definition: extensionPointConfig.definition,
        };
      }

      // eslint-disable-next-line security/detect-object-injection -- false positive for number
      draft.extensionPoints[index] = {
        id: newInnerId,
        ...commonExtensionConfig,
      };
    } else {
      // It's not currently possible to switch from using an extensionPoint package to an inner extensionPoint
      // definition in the Page Editor. Therefore we can just use the rawExtension.extensionPointId directly here.
      // eslint-disable-next-line security/detect-object-injection -- false positive for number
      draft.extensionPoints[index] = {
        id: rawExtension.extensionPointId,
        ...commonExtensionConfig,
      };
    }

    return draft;
  });
}

function selectExtensionPointConfig(
  extension: ModComponentBase
): ModComponentDefinition {
  const extensionPoint: ModComponentDefinition = {
    ...pick(extension, ["label", "config", "permissions", "templateEngine"]),
    id: extension.extensionPointId,
  };

  // To make round-trip testing easier, don't add a `services` property if it didn't already exist
  if (extension.integrationDependencies != null) {
    extensionPoint.services = selectExtensionPointIntegrations(extension);
  }

  return extensionPoint;
}

type RecipeParts = {
  sourceRecipe?: ModDefinition;
  cleanRecipeExtensions: UnresolvedModComponent[];
  dirtyRecipeElements: ModComponentFormState[];
  options?: ModOptionsDefinition;
  metadata?: ModMetadataFormState;
};

const emptyRecipe: UnsavedModDefinition = {
  apiVersion: PAGE_EDITOR_DEFAULT_BRICK_API_VERSION,
  kind: "recipe",
  metadata: {
    id: "" as RegistryId,
    name: "",
  },
  extensionPoints: [],
  definitions: {},
  options: {
    schema: {},
    uiSchema: {},
  },
};

/**
 * Create a copy of `sourceRecipe` (if provided) with `metadata` and `elements`.
 *
 * NOTE: the caller is responsible for updating an extensionPoint package (i.e., that has its own version). This method
 * only handles the extensionPoint if it's an inner definition
 *
 * @param sourceRecipe the original recipe, or undefined for new recipes
 * @param cleanRecipeExtensions the recipe's unchanged, installed extensions
 * @param dirtyRecipeElements the recipe's extension form states (i.e., submitted via Formik)
 * @param options the recipe's options form state
 * @param metadata the recipe's metadata form state
 */
export function buildRecipe({
  sourceRecipe,
  cleanRecipeExtensions,
  dirtyRecipeElements,
  options,
  metadata,
}: RecipeParts): UnsavedModDefinition {
  // If there's no source recipe, then we're creating a new one, so we
  // start with an empty recipe definition that will be filled in
  const recipe: UnsavedModDefinition = sourceRecipe ?? emptyRecipe;

  return produce(recipe, (draft) => {
    // Options dirty state is only populated if a change is made
    if (options) {
      draft.options = isEmpty(options.schema?.properties) ? undefined : options;
    }

    // Metadata dirty state is only populated if a change is made
    if (metadata) {
      draft.metadata = metadata;
    }

    const versionedItems = [...cleanRecipeExtensions, ...dirtyRecipeElements];
    // We need to handle the unlikely edge-case of zero extensions here, hence the null-coalesce
    const itemsApiVersion = versionedItems[0]?.apiVersion ?? recipe.apiVersion;
    const badApiVersion = versionedItems.find(
      (item) => item.apiVersion !== itemsApiVersion
    )?.apiVersion;

    if (badApiVersion) {
      throw new Error(
        `Mod bricks have inconsistent API Versions (${itemsApiVersion}/${badApiVersion}). All bricks in a mod must have the same API Version.`
      );
    }

    if (itemsApiVersion !== recipe.apiVersion) {
      throw new Error(
        `Mod uses API Version ${recipe.apiVersion}, but it's bricks have version ${itemsApiVersion}. Please use the Workshop to edit this mod.`
      );
    }

    const dirtyRecipeExtensions: ModComponentBase[] = dirtyRecipeElements.map(
      (element) => {
        const adapter = ADAPTERS.get(element.type);
        const extension = adapter.selectExtension(element);

        if (isInnerDefinitionRegistryId(extension.extensionPointId)) {
          const extensionPointConfig =
            adapter.selectExtensionPointConfig(element);
          extension.definitions = {
            [extension.extensionPointId]: {
              kind: "extensionPoint",
              definition: extensionPointConfig.definition,
            },
          };
        }

        return extension;
      }
    );

    const { innerDefinitions, extensionPoints } = buildExtensionPoints([
      ...cleanRecipeExtensions,
      ...dirtyRecipeExtensions,
    ]);

    // This sorting is mostly for test ergonomics for easier equality assertions when
    // things stay in the same order in this array. The clean/dirty elements
    // split/recombination logic causes things to get out of order in the result.
    draft.extensionPoints = sortBy(extensionPoints, (x) => x.id);
    draft.definitions = innerDefinitions;
  });
}

type BuildExtensionPointsResult = {
  innerDefinitions: InnerDefinitions;
  extensionPoints: ModComponentDefinition[];
};

function buildExtensionPoints(
  extensions: ModComponentBase[]
): BuildExtensionPointsResult {
  const innerDefinitions: InnerDefinitions = {};
  const extensionPoints: ModComponentDefinition[] = [];

  for (const extension of extensions) {
    // When an extensionPointId is an @inner/* style reference, or if the
    // id has already been used in the recipe, we need to generate a new
    // extensionPointId to use instead. If we are changing the extensionPointId
    // of the current extension, then we need to keep track of this change
    // so that we can build the extensionPoint with the correct id.
    let newExtensionPointId: RegistryId | InnerDefinitionRef = null;

    for (const [extensionPointId, definition] of Object.entries(
      extension.definitions ?? {}
    )) {
      const usedExtensionPointIds = Object.keys(innerDefinitions);

      let isDefinitionAlreadyAdded = false;
      let needsFreshExtensionPointId = false;

      if (isInnerDefinitionRegistryId(extensionPointId)) {
        // Always replace inner ids
        needsFreshExtensionPointId = true;

        // Check to see if the definition has already been added under a different id
        for (const [id, innerDefinition] of Object.entries(innerDefinitions)) {
          if (isEqual(definition, innerDefinition)) {
            // We found a match in the definitions we've already built
            isDefinitionAlreadyAdded = true;

            // If this definition matches the extension's extensionPointId, track
            // the id change with our variable declared above.
            if (extension.extensionPointId === extensionPointId) {
              newExtensionPointId = id as InnerDefinitionRef;
            }

            // If we found a matching definition, we don't need to keep searching
            break;
          }
        }
      } else if (usedExtensionPointIds.includes(extensionPointId)) {
        // We already used this extensionPointId, need to generate a fresh one
        needsFreshExtensionPointId = true;

        // eslint-disable-next-line security/detect-object-injection
        if (isEqual(definition, innerDefinitions[extensionPointId])) {
          // Not only has the id been used before, but the definition deeply matches
          // the one being added as well
          isDefinitionAlreadyAdded = true;
        }
      }

      if (isDefinitionAlreadyAdded) {
        // This definition has already been added to the recipe, so we can move on
        continue;
      }

      const newInnerId = needsFreshExtensionPointId
        ? freshIdentifier(
            DEFAULT_EXTENSION_POINT_VAR as SafeString,
            usedExtensionPointIds
          )
        : extensionPointId;

      // If the definition being added had the same extensionPointId as the extension,
      // and if we generated a new extensionPointId for the definition, then we also
      // need to update the id for the extensionPoint we're going to add that references
      // this definition.
      if (
        needsFreshExtensionPointId &&
        extension.extensionPointId === extensionPointId
      ) {
        newExtensionPointId = newInnerId as InnerDefinitionRef;
      }

      // eslint-disable-next-line security/detect-object-injection -- we just constructed the id
      innerDefinitions[newInnerId] = definition;
    }

    // Construct the extension point config from the extension
    const extensionPoint = selectExtensionPointConfig(extension);

    // Add the extensionPoint, replacing the id with our updated
    // extensionPointId, if we've tracked a change in newExtensionPointId
    extensionPoints.push({
      ...extensionPoint,
      id: newExtensionPointId ?? extensionPoint.id,
    });
  }

  return {
    innerDefinitions,
    extensionPoints,
  };
}
