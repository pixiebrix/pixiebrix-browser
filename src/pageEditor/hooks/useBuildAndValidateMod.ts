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
  buildNewMod,
  type ModParts,
} from "@/pageEditor/panes/save/saveHelpers";
import reportEvent from "@/telemetry/reportEvent";
import { useCallback } from "react";
import { Events } from "@/telemetry/events";
import { BusinessError } from "@/errors/businessErrors";
import { useDispatch } from "react-redux";
import useCheckModStarterBrickInvariants from "@/pageEditor/hooks/useCheckModStarterBrickInvariants";
import useCompareModComponentCounts from "@/pageEditor/hooks/useCompareModComponentCounts";
import { actions as editorActions } from "@/pageEditor/slices/editorSlice";
import { type JsonObject } from "type-fest";
import { type UnsavedModDefinition } from "@/types/modDefinitionTypes";
import { type ActivatedModComponent } from "@/types/modComponentTypes";
import { type ModComponentFormState } from "@/pageEditor/starterBricks/formStateTypes";

type BuildAndValidateModParts = Partial<ModParts> & {
  sourceModComponent?: ActivatedModComponent;
  sourceModComponentFormState?: ModComponentFormState;
};

type UseBuildAndValidateModReturn = {
  buildAndValidateMod: (
    modParts: BuildAndValidateModParts,
  ) => Promise<UnsavedModDefinition>;
};

function useBuildAndValidateMod(): UseBuildAndValidateModReturn {
  const dispatch = useDispatch();
  const compareModComponentCountsToModDefinition =
    useCompareModComponentCounts();
  const checkModStarterBrickInvariants = useCheckModStarterBrickInvariants();

  const buildAndValidateMod = useCallback(
    async ({
      sourceMod,
      sourceModComponent,
      sourceModComponentFormState,
      cleanModComponents,
      dirtyModComponentFormStates,
      dirtyModOptions,
      dirtyModMetadata,
    }: BuildAndValidateModParts) => {
      const newMod = buildNewMod({
        sourceMod,
        cleanModComponents,
        dirtyModComponentFormStates,
        dirtyModOptions,
        dirtyModMetadata,
      });

      const modComponentDefinitionCountsMatch =
        compareModComponentCountsToModDefinition(newMod, {
          sourceModDefinition: sourceMod,
          sourceModComponent,
          sourceModComponentFormState,
        });
      const modComponentStarterBricksMatch =
        await checkModStarterBrickInvariants(newMod, {
          sourceModDefinition: sourceMod,
          sourceModComponent,
          sourceModComponentFormState,
        });

      if (
        !modComponentDefinitionCountsMatch ||
        !modComponentStarterBricksMatch
      ) {
        // Not including modDefinition because it can be 1.5MB+ in some rare cases
        // See discussion: https://github.com/pixiebrix/pixiebrix-extension/pull/7629/files#r1492864349
        reportEvent(Events.PAGE_EDITOR_MOD_SAVE_ERROR, {
          // Metadata is an object, but doesn't extend JsonObject so typescript doesn't like it
          modMetadata: newMod.metadata as unknown as JsonObject,
          modComponentDefinitionCountsMatch,
          modComponentStarterBricksMatch,
        });
        dispatch(editorActions.showSaveDataIntegrityErrorModal());

        throw new BusinessError("Mod save failed due to data integrity error");
      }

      return newMod;
    },
    [
      checkModStarterBrickInvariants,
      compareModComponentCountsToModDefinition,
      dispatch,
    ],
  );

  return { buildAndValidateMod };
}

export default useBuildAndValidateMod;
