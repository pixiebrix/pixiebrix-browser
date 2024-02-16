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

import { type UnsavedModDefinition } from "@/types/modDefinitionTypes";
import { useSelector } from "react-redux";
import { useCallback } from "react";
import { selectGetCleanComponentsAndDirtyFormStatesForMod } from "@/pageEditor/slices/selectors/selectGetCleanComponentsAndDirtyFormStatesForMod";

/**
 * @returns {function} - A function that compares the number of mod components in the redux state and the mod definition
 */
function useCompareModComponentCounts(): (
  modDefinition: UnsavedModDefinition,
) => boolean {
  const getCleanComponentsAndDirtyFormStatesForMod = useSelector(
    selectGetCleanComponentsAndDirtyFormStatesForMod,
  );

  return useCallback(
    (modDefinition: UnsavedModDefinition) => {
      const modId = modDefinition.metadata.id;
      const { cleanModComponents, dirtyModComponentFormStates } =
        getCleanComponentsAndDirtyFormStatesForMod(modId);

      const totalNumberModComponentsFromState =
        cleanModComponents.length + dirtyModComponentFormStates.length;
      const totalNumberModComponentsFromDefinition =
        modDefinition.extensionPoints.length;

      return (
        totalNumberModComponentsFromState ===
        totalNumberModComponentsFromDefinition
      );
    },
    [getCleanComponentsAndDirtyFormStatesForMod],
  );
}

export default useCompareModComponentCounts;
