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

import { ensureModComponentFormStatePermissionsFromUserGesture } from "@/pageEditor/editorPermissionsHelpers";
import { type ModMetadataFormState } from "@/pageEditor/store/editor/pageEditorTypes";
import reportEvent from "@/telemetry/reportEvent";
import { useCallback } from "react";
import { Events } from "@/telemetry/events";
import { useCreateModDefinitionMutation } from "@/data/service/api";
import { useDispatch, useSelector } from "react-redux";
import { actions as editorActions } from "@/pageEditor/store/editor/editorSlice";
import {
  isModComponentFormState,
  mapModDefinitionUpsertResponseToModDefinition,
} from "@/pageEditor/utils";
import useBuildAndValidateMod from "@/pageEditor/hooks/useBuildAndValidateMod";
import { type RegistryId } from "@/types/registryTypes";
import {
  selectActiveModComponentFormState,
  selectActiveModId,
  selectGetDraftModComponentsForMod,
  selectGetModDraftStateForModId,
} from "@/pageEditor/store/editor/editorSelectors";
import { createPrivateSharing } from "@/utils/registryUtils";
import updateReduxForSavedModDefinition from "@/pageEditor/hooks/updateReduxForSavedModDefinition";
import { type AppDispatch } from "@/pageEditor/store/store";

type UseCreateModFromUnsavedModReturn = {
  createModFromUnsavedMod: (
    unsavedModId: RegistryId,
    modMetadata: ModMetadataFormState,
  ) => Promise<void>;
};

/**
 * This hook provides a callback function to create a mod from an unsaved mod
 * that has never been saved to the server.
 */
function useCreateModFromUnsavedMod(): UseCreateModFromUnsavedModReturn {
  const dispatch = useDispatch<AppDispatch>();
  const [createModDefinitionOnServer] = useCreateModDefinitionMutation();
  const { buildAndValidateMod } = useBuildAndValidateMod();
  const activeModId = useSelector(selectActiveModId);
  const activeModComponentFormState = useSelector(
    selectActiveModComponentFormState,
  );
  const getDraftModComponentsForMod = useSelector(
    selectGetDraftModComponentsForMod,
  );
  const getModDraftStateForModId = useSelector(selectGetModDraftStateForModId);

  /**
   * Save a new, unsaved mod to the server.
   *
   * @param unsavedModId The (local only) registry ID of the unsaved mod
   * @param modMetadata The metadata for the new mod to be created
   */
  const createModFromUnsavedMod = useCallback(
    (
      unsavedModId: RegistryId,
      newModMetadata: ModMetadataFormState,
      // eslint-disable-next-line @typescript-eslint/promise-function-async -- permissions check must be called in the user gesture context, `async-await` can break the call chain
    ) => {
      const draftModComponents = getDraftModComponentsForMod(unsavedModId);

      return ensureModComponentFormStatePermissionsFromUserGesture(
        draftModComponents.filter((x) => isModComponentFormState(x)),
        // eslint-disable-next-line promise/prefer-await-to-then -- permissions check must be called in the user gesture context, `async-await` can break the call chain
      ).then(async (hasPermissions) => {
        if (!hasPermissions) {
          return;
        }

        const newModId = newModMetadata.id;
        const draftModState = getModDraftStateForModId(unsavedModId);

        const unsavedModDefinition = await buildAndValidateMod({
          // Pass new mod metadata, but the draft state from the unsaved mod
          dirtyModMetadata: newModMetadata,
          draftModComponents,
          dirtyModOptionsDefinition: draftModState.dirtyModOptionsDefinition,
          dirtyModVariablesDefinition: draftModState.variablesDefinition,
        });

        const upsertResponse = await createModDefinitionOnServer({
          modDefinition: unsavedModDefinition,
          ...createPrivateSharing(),
        }).unwrap();

        await dispatch(
          updateReduxForSavedModDefinition({
            modIdToReplace: unsavedModId,
            modDefinition: mapModDefinitionUpsertResponseToModDefinition(
              unsavedModDefinition,
              upsertResponse,
            ),
            draftModComponents,
            isReactivate: false,
          }),
        );

        if (activeModId === unsavedModId) {
          // If the mod list item is selected, reselect the mod item using the new id
          dispatch(editorActions.setActiveModId(newModId));
          // Preserve the activeModComponentId if there is one
          if (activeModComponentFormState?.uuid) {
            dispatch(
              editorActions.setActiveModComponentId(
                activeModComponentFormState.uuid,
              ),
            );
          }
        } else if (
          activeModComponentFormState?.modMetadata.id === unsavedModId
        ) {
          // A mod component in the unsaved mod is selected. Expand the mod using the new mod id
          // XXX: currently, there's a short flicker for the mod to re-expand
          dispatch(editorActions.setExpandedModId(newModId));
        }

        reportEvent(Events.PAGE_EDITOR_MOD_CREATE, {
          modId: newModId,
        });
      });
    },
    [
      activeModId,
      activeModComponentFormState,
      getDraftModComponentsForMod,
      getModDraftStateForModId,
      buildAndValidateMod,
      createModDefinitionOnServer,
      dispatch,
    ],
  );

  return {
    createModFromUnsavedMod,
  };
}

export default useCreateModFromUnsavedMod;
