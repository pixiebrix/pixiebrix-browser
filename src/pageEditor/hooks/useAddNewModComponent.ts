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

import { useDispatch, useSelector } from "react-redux";
import { useCallback } from "react";
import notify from "@/utils/notify";
import { actions } from "@/pageEditor/store/editor/editorSlice";
import { internalStarterBrickMetaFactory } from "@/pageEditor/starterBricks/base";
import { isSpecificError } from "@/errors/errorHelpers";
import { type ModComponentFormStateAdapter } from "@/pageEditor/starterBricks/modComponentFormStateAdapter";
import { updateDraftModComponent } from "@/contentScript/messenger/api";
import { type SettingsState } from "@/store/settings/settingsTypes";
import useFlags from "@/hooks/useFlags";
import { type ModComponentFormState } from "@/pageEditor/starterBricks/formStateTypes";
import reportEvent from "@/telemetry/reportEvent";
import { Events } from "@/telemetry/events";
import { CancelError } from "@/errors/businessErrors";
import {
  allFramesInInspectedTab,
  getCurrentInspectedURL,
  inspectedTab,
} from "@/pageEditor/context/connection";
import { getExampleBrickPipeline } from "@/pageEditor/panes/insert/exampleStarterBrickConfigs";
import { StarterBrickTypes } from "@/types/starterBrickTypes";
import { openSidePanel } from "@/utils/sidePanelUtils";
import { useInsertPane } from "@/pageEditor/panes/insert/InsertPane";
import { type ModMetadata } from "@/types/modComponentTypes";
import { createNewUnsavedModMetadata } from "@/utils/modUtils";
import { selectActivatedModMetadatas } from "@/pageEditor/store/editor/editorSelectors";

export type AddNewModComponent = (
  adapter: ModComponentFormStateAdapter,
) => void;

function useAddNewModComponent(modMetadata?: ModMetadata): AddNewModComponent {
  const dispatch = useDispatch();
  const { setInsertingStarterBrickType } = useInsertPane();
  // XXX: useFlags is async. The flag query might not be initialized by the time the callback is called. Ensure
  // useFlags has already been used on the page, e.g., the AddStarterBrickButton, to ensure the flags have loaded by
  // the time the returned callback is called.
  const { flagOff } = useFlags();
  const suggestElements = useSelector<{ settings: SettingsState }, boolean>(
    (x) => x.settings.suggestElements ?? false,
  );

  const modMetadatas = useSelector(selectActivatedModMetadatas);

  const getNewModName = useCallback((): string => {
    const nameBase = "New Mod";
    const existingModNames = modMetadatas.map((m) => m.name);
    let newModName = nameBase;
    let i = 1;
    while (existingModNames.includes(newModName)) {
      newModName = `${nameBase} ${i}`;
      i++;
    }

    return newModName;
  }, [modMetadatas]);

  const getInitialModComponentFormState = useCallback(
    async ({
      starterBrickType,
      selectNativeElement,
      fromNativeElement,
    }: ModComponentFormStateAdapter): Promise<ModComponentFormState> => {
      let element = null;
      if (selectNativeElement) {
        setInsertingStarterBrickType(starterBrickType);
        element = await selectNativeElement(inspectedTab, suggestElements);
        setInsertingStarterBrickType(null);
      }

      const url = await getCurrentInspectedURL();
      const metadata = internalStarterBrickMetaFactory();
      const initialFormState = fromNativeElement(url, metadata, element);

      initialFormState.modComponent.brickPipeline =
        getExampleBrickPipeline(starterBrickType);

      initialFormState.modMetadata =
        modMetadata ??
        createNewUnsavedModMetadata({
          modName: getNewModName(),
        });

      return initialFormState as ModComponentFormState;
    },
    [getNewModName, modMetadata, setInsertingStarterBrickType, suggestElements],
  );

  return useCallback(
    async (adapter: ModComponentFormStateAdapter) => {
      if (adapter.flag && flagOff(adapter.flag)) {
        dispatch(actions.betaError());
        return;
      }

      try {
        const initialFormState = await getInitialModComponentFormState(adapter);

        dispatch(actions.addModComponentFormState(initialFormState));
        // Need to explicitly check availability of the new component form state
        // TODO: refactor this to be an implicit side-effect in the reducer (add action above possibly needs to be a thunk?)
        dispatch(actions.checkActiveModComponentAvailability());

        updateDraftModComponent(
          allFramesInInspectedTab,
          adapter.asDraftModComponent(initialFormState),
        );

        if (adapter.starterBrickType === StarterBrickTypes.SIDEBAR_PANEL) {
          // For convenience, open the side panel if it's not already open so that the user doesn't
          // have to manually toggle it
          void openSidePanel(inspectedTab.tabId);
        }
      } catch (error) {
        if (isSpecificError(error, CancelError)) {
          return;
        }

        notify.error({
          message: `Error adding ${adapter.label.toLowerCase()}`,
          error,
        });
      }

      if (modMetadata) {
        reportEvent(Events.MOD_ADD_STARTER_BRICK, {
          starterBrickType: adapter.starterBrickType,
          modId: modMetadata.id,
        });
      } else {
        reportEvent(Events.MOD_CREATE_NEW, {
          type: adapter.starterBrickType,
        });
      }
    },
    [flagOff, modMetadata, dispatch, getInitialModComponentFormState],
  );
}

export default useAddNewModComponent;
