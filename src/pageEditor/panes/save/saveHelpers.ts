/*
 * Copyright (C) 2022 PixieBrix, Inc.
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
  RegistryId,
  Metadata,
  IExtension,
  SafeString,
  InnerDefinitionRef,
  InnerDefinitions,
  UnresolvedExtension,
} from "@/core";
import {
  EditablePackage,
  ExtensionPointConfig,
  OptionsDefinition,
  RecipeDefinition,
  RecipeMetadataFormState,
  UnsavedRecipeDefinition,
} from "@/types/definitions";
import { PACKAGE_REGEX, validateRegistryId } from "@/types/helpers";
import { compact, isEmpty, isEqual, pick, sortBy } from "lodash";
import { produce } from "immer";
import { ADAPTERS } from "@/pageEditor/extensionPoints/adapter";
import { freshIdentifier } from "@/utils";
import { FormState } from "@/pageEditor/pageEditorTypes";
import { isInnerExtensionPoint } from "@/registry/internal";
import {
  DEFAULT_EXTENSION_POINT_VAR,
  PAGE_EDITOR_DEFAULT_BRICK_API_VERSION,
} from "@/pageEditor/extensionPoints/base";
import slugify from "slugify";
import { Except } from "type-fest";

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

export function generateRecipeId(
  userScope: string,
  extensionLabel: string
): RegistryId {
  return validateRegistryId(
    `${userScope}/${slugify(extensionLabel).toLowerCase()}`
  );
}

export function isRecipeEditable(
  editablePackages: EditablePackage[],
  recipe: RecipeDefinition
) {
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
  sourceRecipe: RecipeDefinition,
  extension: IExtension
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
      `There are no extensions in the blueprint with label "${extension.label}". You must edit the blueprint in the Workshop`
    );
  }

  if (labelMatches.length > 1) {
    throw new Error(
      `There are multiple extensions in the blueprint with label "${extension.label}". You must edit the blueprint in the Workshop`
    );
  }

  if (labelMatches.length === 1) {
    return sourceRecipe.extensionPoints.findIndex(
      (x) => x.label === extension.label
    );
  }
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
  sourceRecipe: RecipeDefinition,
  metadata: Metadata,
  installedExtensions: IExtension[],
  element: FormState
): UnsavedRecipeDefinition {
  const installedExtension = installedExtensions.find(
    (x) => x.id === element.uuid
  );

  if (installedExtension == null) {
    throw new Error(
      `Could not find local copy of recipe extension: ${element.uuid}`
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
          `Element's API Version (${element.apiVersion}) does not match recipe's API Version (${sourceRecipe.apiVersion}) and recipe's API Version cannot be updated`
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
    const hasInnerExtensionPoint = isInnerExtensionPoint(extensionPointId);

    const commonExtensionConfig: Except<ExtensionPointConfig, "id"> = {
      ...pick(rawExtension, [
        "label",
        "config",
        "permissions",
        "templateEngine",
      ]),
    };

    // The services field is optional, so only add it to the config if the raw
    // extension has a value. Normalizing here makes testing harder because we
    // then have to account for the normalized value in assertions.
    if (rawExtension.services) {
      commonExtensionConfig.services = Object.fromEntries(
        rawExtension.services.map((x) => [x.outputKey, x.id])
      );
    }

    if (hasInnerExtensionPoint) {
      const extensionPointConfig = adapter.selectExtensionPoint(element);

      // eslint-disable-next-line security/detect-object-injection -- false positive for number
      const originalInnerId = sourceRecipe.extensionPoints[index].id;
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

function selectExtensionPoint(extension: IExtension): ExtensionPointConfig {
  const extensionPoint: ExtensionPointConfig = {
    ...pick(extension, ["label", "config", "permissions", "templateEngine"]),
    id: extension.extensionPointId,
  };

  if (!isEmpty(extension.services)) {
    extensionPoint.services = Object.fromEntries(
      extension.services.map((x) => [x.outputKey, x.id])
    );
  }

  return extensionPoint;
}

type RecipeParts = {
  sourceRecipe?: RecipeDefinition;
  cleanRecipeExtensions: UnresolvedExtension[];
  dirtyRecipeElements: FormState[];
  options?: OptionsDefinition;
  metadata?: RecipeMetadataFormState;
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
}: RecipeParts): UnsavedRecipeDefinition {
  // If there's no source recipe, then we're creating a new one, so we
  // start with an empty recipe definition that will be filled in
  const recipe: UnsavedRecipeDefinition = sourceRecipe ?? {
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
    const itemsApiVersion = versionedItems[0]?.apiVersion ?? recipe.apiVersion;
    const badApiVersion = versionedItems.find(
      (item) => item.apiVersion !== itemsApiVersion
    )?.apiVersion;

    if (badApiVersion) {
      throw new Error(
        `Blueprint extensions have inconsistent API Versions (${itemsApiVersion}/${badApiVersion}). All extensions in a blueprint must have the same API Version.`
      );
    }

    if (itemsApiVersion !== recipe.apiVersion) {
      throw new Error(
        `Blueprint has API Version ${recipe.apiVersion}, but it's extensions have version ${itemsApiVersion}. Please use the Workshop to edit this blueprint.`
      );
    }

    const dirtyRecipeExtensions: IExtension[] = dirtyRecipeElements.map(
      (element) => {
        const adapter = ADAPTERS.get(element.type);
        const extension = adapter.selectExtension(element);

        if (isInnerExtensionPoint(extension.extensionPointId)) {
          const extensionPointConfig = adapter.selectExtensionPoint(element);
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

    const recipeInnerDefinitions: InnerDefinitions = {};
    const extensionPoints: ExtensionPointConfig[] = [];

    // Loop through all the IExtensions, pull out the definitions object, put it into the recipe definitions
    for (const extension of [
      ...cleanRecipeExtensions,
      ...dirtyRecipeExtensions,
    ]) {
      let extensionPointId: RegistryId | InnerDefinitionRef = null;
      for (const [innerId, definition] of Object.entries(
        extension.definitions ?? {}
      )) {
        const innerKeys = Object.keys(recipeInnerDefinitions);

        let found = false;
        let needsFreshId = false;
        if (isInnerExtensionPoint(innerId)) {
          needsFreshId = true;
          for (const [id, innerDefinition] of Object.entries(
            recipeInnerDefinitions
          )) {
            if (isEqual(definition, innerDefinition)) {
              if (extension.extensionPointId === innerId) {
                extensionPointId = id as InnerDefinitionRef;
              }

              found = true;
              break;
            }
          }
        } else if (innerKeys.includes(innerId)) {
          needsFreshId = true;
          // eslint-disable-next-line security/detect-object-injection
          if (isEqual(definition, recipeInnerDefinitions[innerId])) {
            found = true;
          }
        }

        if (found) {
          // This definition has already been added to the recipe
          continue;
        }

        const newInnerId = needsFreshId
          ? freshIdentifier(
              DEFAULT_EXTENSION_POINT_VAR as SafeString,
              innerKeys
            )
          : innerId;

        if (needsFreshId && extension.extensionPointId === innerId) {
          extensionPointId = newInnerId as InnerDefinitionRef;
        }

        // eslint-disable-next-line security/detect-object-injection -- we just constructed the id
        recipeInnerDefinitions[newInnerId] = definition;
      }

      const extensionPoint = selectExtensionPoint(extension);

      extensionPoints.push({
        ...extensionPoint,
        id: extensionPointId ?? extensionPoint.id,
      });
    }

    draft.extensionPoints = sortBy(extensionPoints, (x) => x.id);
    draft.definitions = recipeInnerDefinitions;
  });
}
