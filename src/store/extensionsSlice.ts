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

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { type CloudExtension, type Deployment } from "@/types/contract";
import { reportEvent } from "@/telemetry/events";
import { selectEventData } from "@/telemetry/deployments";
import { contextMenus } from "@/background/messenger/api";
import { uuidv4 } from "@/types/helpers";
import { cloneDeep, partition, pick } from "lodash";
import { saveUserExtension } from "@/services/apiClient";
import reportError from "@/telemetry/reportError";
import {
  type ExtensionOptionsState,
  type LegacyExtensionObjectState,
  type OptionsState,
} from "@/store/extensionsTypes";
import { type Except } from "type-fest";
import { assertExtensionNotResolved } from "@/runtime/runtimeUtils";
import { revertAll } from "@/store/commonActions";
import {
  type IExtension,
  type PersistedExtension,
} from "@/types/extensionTypes";
import { type UUID } from "@/types/stringTypes";
import {
  type RecipeDefinition,
  type ExtensionDefinition,
} from "@/types/recipeTypes";
import { type RegistryId } from "@/types/registryTypes";
import { type OutputKey, type OptionsArgs } from "@/types/runtimeTypes";

const initialExtensionsState: ExtensionOptionsState = {
  extensions: [],
};

function selectDeploymentContext(
  deployment: Deployment
): IExtension["_deployment"] | undefined {
  if (deployment) {
    return {
      id: deployment.id,
      timestamp: deployment.updated_at,
      active: deployment.active,
    };
  }
}

const extensionsSlice = createSlice({
  name: "extensions",
  initialState: initialExtensionsState,
  reducers: {
    // Helper method to directly update extensions in tests. Can't use installCloudExtension because CloudExtension
    // doesn't have the _recipe field
    UNSAFE_setExtensions(
      state,
      { payload }: PayloadAction<PersistedExtension[]>
    ) {
      state.extensions = cloneDeep(payload);
    },

    installCloudExtension(
      state,
      { payload }: PayloadAction<{ extension: CloudExtension }>
    ) {
      const { extension } = payload;

      reportEvent("ExtensionCloudActivate", selectEventData(extension));

      // NOTE: do not save the extensions in the cloud (because the user can just install from the marketplace /
      // or activate the deployment again

      state.extensions.push({ ...extension, active: true });

      void contextMenus.preload([extension]);
    },

    attachExtension(
      state,
      {
        payload,
      }: PayloadAction<{
        extensionId: UUID;
        recipeMetadata: IExtension["_recipe"];
      }>
    ) {
      const { extensionId, recipeMetadata } = payload;
      const extension = state.extensions.find((x) => x.id === extensionId);
      extension._recipe = recipeMetadata;
    },

    installRecipe(
      state,
      {
        payload,
      }: PayloadAction<{
        recipe: RecipeDefinition;
        services?: Record<RegistryId, UUID>;
        extensionPoints: ExtensionDefinition[];
        optionsArgs?: OptionsArgs;
        deployment?: Deployment;
      }>
    ) {
      requireLatestState(state);

      const {
        recipe,
        services: auths,
        optionsArgs,
        extensionPoints,
        deployment,
      } = payload;

      for (const {
        // Required
        id: extensionPointId,
        label,
        config,
        // Optional
        services,
        permissions,
        templateEngine,
      } of extensionPoints) {
        const extensionId = uuidv4();

        const timestamp = new Date().toISOString();

        if (extensionPointId == null) {
          throw new Error("extensionPointId is required");
        }

        if (recipe.updated_at == null) {
          // Since 1.4.8 we're tracking the updated_at timestamp of recipes
          throw new Error("updated_at is required");
        }

        if (recipe.sharing == null) {
          // Since 1.4.6 we're tracking the sharing information of recipes
          throw new Error("sharing is required");
        }

        const extension: Except<
          PersistedExtension,
          "_unresolvedExtensionBrand"
        > = {
          id: extensionId,
          // Default to `v1` for backward compatability
          apiVersion: recipe.apiVersion ?? "v1",
          _deployment: selectDeploymentContext(deployment),
          _recipe: {
            ...pick(recipe.metadata, ["id", "version", "name", "description"]),
            sharing: recipe.sharing,
            updated_at: recipe.updated_at,
          },
          // Definitions are pushed down into the extensions. That's OK because `resolveDefinitions` determines
          // uniqueness based on the content of the definition. Therefore, bricks will be re-used as necessary
          definitions: recipe.definitions ?? {},
          optionsArgs,
          label,
          extensionPointId,
          config,
          active: true,
          createTimestamp: timestamp,
          updateTimestamp: timestamp,
        };

        // Set optional fields only if the source extension has a value. Normalizing the values
        // here makes testing harder because we then have to account for the normalized value in assertions.
        if (services) {
          extension.services = Object.entries(services).map(
            ([outputKey, id]: [OutputKey, RegistryId]) => ({
              outputKey,
              config: auths[id], // eslint-disable-line security/detect-object-injection -- type-checked as RegistryId
              id,
            })
          );
        }

        if (permissions) {
          extension.permissions = permissions;
        }

        if (templateEngine) {
          extension.templateEngine = templateEngine;
        }

        assertExtensionNotResolved(extension);

        reportEvent("ExtensionActivate", selectEventData(extension));

        // NOTE: do not save the extensions in the cloud (because the user can just install from the marketplace /
        // or activate the deployment again

        state.extensions.push(extension);

        void contextMenus.preload([extension]);
      }
    },
    // XXX: why do we expose a `extensionId` in addition IExtension's `id` prop here?
    saveExtension(
      state,
      {
        payload,
      }: PayloadAction<{
        extension: (IExtension | PersistedExtension) & {
          createTimestamp?: string;
        };
        pushToCloud: boolean;
      }>
    ) {
      requireLatestState(state);

      const timestamp = new Date().toISOString();

      const {
        extension: {
          id,
          apiVersion,
          extensionPointId,
          config,
          definitions,
          label,
          optionsArgs,
          services,
          _deployment,
          createTimestamp = timestamp,
          _recipe,
        },
        pushToCloud,
      } = payload;

      // Support both extensionId and id to keep the API consistent with the shape of the stored extension
      if (id == null) {
        throw new Error("id or extensionId is required");
      }

      if (extensionPointId == null) {
        throw new Error("extensionPointId is required");
      }

      const extension: Except<PersistedExtension, "_unresolvedExtensionBrand"> =
        {
          id,
          apiVersion,
          extensionPointId,
          _recipe,
          _deployment: undefined,
          label,
          definitions,
          optionsArgs,
          services,
          config,
          createTimestamp,
          updateTimestamp: timestamp,
          active: true,
        };

      assertExtensionNotResolved(extension);

      if (pushToCloud && !_deployment) {
        // In the future, we'll want to make the Redux action async. For now, just fail silently in the interface
        void saveUserExtension(extension);
      }

      const index = state.extensions.findIndex((x) => x.id === id);

      if (index >= 0) {
        // eslint-disable-next-line security/detect-object-injection -- array index from findIndex
        state.extensions[index] = extension;
      } else {
        state.extensions.push(extension);
      }
    },
    updateExtension(
      state,
      action: PayloadAction<{ id: UUID } & Partial<PersistedExtension>>
    ) {
      const { id, ...extensionUpdate } = action.payload;
      const index = state.extensions.findIndex((x) => x.id === id);

      if (index === -1) {
        reportError(
          new Error(
            `Can't find extension in optionsSlice to update. Target extension id: ${id}.`
          )
        );
        return;
      }

      // eslint-disable-next-line security/detect-object-injection -- index is number
      state.extensions[index] = {
        ...state.extensions.at(index),
        ...extensionUpdate,
      };
    },

    updateRecipeMetadataForExtensions(
      state,
      action: PayloadAction<IExtension["_recipe"]>
    ) {
      const metadata = action.payload;
      const recipeExtensions = state.extensions.filter(
        (extension) => extension._recipe?.id === metadata.id
      );
      for (const extension of recipeExtensions) {
        extension._recipe = metadata;
      }
    },

    removeRecipeById(state, { payload: recipeId }: PayloadAction<RegistryId>) {
      requireLatestState(state);

      const [, extensions] = partition(
        state.extensions,
        (x) => x._recipe?.id === recipeId
      );

      state.extensions = extensions;
    },

    removeExtensions(
      state,
      { payload: { extensionIds } }: PayloadAction<{ extensionIds: UUID[] }>
    ) {
      requireLatestState(state);

      // NOTE: We aren't deleting the extension on the server. The user must do that separately from the dashboard
      state.extensions = state.extensions.filter(
        (x) => !extensionIds.includes(x.id)
      );
    },

    removeExtension(
      state,
      { payload: { extensionId } }: PayloadAction<{ extensionId: UUID }>
    ) {
      requireLatestState(state);

      // NOTE: We aren't deleting the extension on the server. The user must do that separately from the dashboard
      state.extensions = state.extensions.filter((x) => x.id !== extensionId);
    },
  },
  extraReducers(builder) {
    builder.addCase(revertAll, () => initialExtensionsState);
  },
});

/**
 * Throw a `TypeError` if the Redux state has not been migrated.
 */
function requireLatestState(
  state: OptionsState
): asserts state is LegacyExtensionObjectState | ExtensionOptionsState {
  if (!Array.isArray(state.extensions)) {
    throw new TypeError("redux state has not been migrated");
  }
}

export const { actions } = extensionsSlice;

export default extensionsSlice;
