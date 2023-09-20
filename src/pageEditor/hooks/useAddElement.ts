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

import { useDispatch, useSelector } from "react-redux";
import { useCallback } from "react";
import notify from "@/utils/notify";
import { actions } from "@/pageEditor/slices/editorSlice";
import { internalStarterBrickMetaFactory } from "@/pageEditor/starterBricks/base";
import { isSpecificError } from "@/errors/errorHelpers";
import { type ElementConfig } from "@/pageEditor/starterBricks/elementConfig";
import { getCurrentURL, thisTab } from "@/pageEditor/utils";
import { updateDynamicElement } from "@/contentScript/messenger/api";
import { type SettingsState } from "@/store/settings/settingsTypes";
import useFlags from "@/hooks/useFlags";
import { type ModComponentFormState } from "@/pageEditor/starterBricks/formStateTypes";
import { selectFrameState } from "@/pageEditor/tabState/tabStateSelectors";
import reportEvent from "@/telemetry/reportEvent";
import { Events } from "@/telemetry/events";
import { CancelError } from "@/errors/businessErrors";

type AddElement = (config: ElementConfig) => void;

function useAddElement(): AddElement {
  const dispatch = useDispatch();
  const { meta } = useSelector(selectFrameState);
  const { flagOff } = useFlags();
  const suggestElements = useSelector<{ settings: SettingsState }, boolean>(
    (x) => x.settings.suggestElements
  );

  return useCallback(
    async (config: ElementConfig) => {
      if (config.flag && flagOff(config.flag)) {
        dispatch(actions.betaError());
        return;
      }

      dispatch(actions.toggleInsert(config.elementType));

      if (!config.selectNativeElement) {
        // If the foundation is not for a native element, stop after toggling insertion mode
        return;
      }

      try {
        const element = await config.selectNativeElement(
          thisTab,
          suggestElements
        );
        const url = await getCurrentURL();

        const metadata = internalStarterBrickMetaFactory();

        const initialState = config.fromNativeElement(
          url,
          metadata,
          element,
          meta?.frameworks ?? []
        );

        await updateDynamicElement(
          thisTab,
          config.asDynamicElement(initialState)
        );

        dispatch(actions.addElement(initialState as ModComponentFormState));
        dispatch(actions.checkActiveElementAvailability());

        reportEvent(Events.MOD_COMPONENT_ADD_NEW, {
          type: config.elementType,
        });
      } catch (error) {
        if (isSpecificError(error, CancelError)) {
          return;
        }

        notify.error({
          message: `Error adding ${config.label.toLowerCase()}`,
          error,
        });
      } finally {
        dispatch(actions.toggleInsert(null));
      }
    },
    [dispatch, meta?.frameworks, flagOff, suggestElements]
  );
}

export default useAddElement;
