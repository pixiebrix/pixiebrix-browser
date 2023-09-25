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

import { useSelector } from "react-redux";
import { selectSettings } from "@/store/settings/settingsSelectors";
import { useEffect, useReducer, type MutableRefObject } from "react";
import {
  getLikelyVariableAtPosition,
  getVariableAtPosition,
} from "@/components/fields/schemaFields/widgets/varPopup/likelyVariableUtils";
import { type FieldInputMode } from "@/components/fields/schemaFields/fieldInputMode";
import { type UnknownObject } from "@/types/objectTypes";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import useDebouncedEffect from "@/hooks/useDebouncedEffect";

import { waitAnimationFrame } from "@/utils/domUtils";

type Props = {
  inputMode: FieldInputMode;
  inputElementRef: MutableRefObject<HTMLElement>;
  value: string;
};

type State = {
  /**
   * True if the menu is currently showing.
   */
  isMenuShowing: boolean;
  /**
   * The variable that the user is interacting with.
   */
  likelyVariable: string | null;
};

const initialState: State = {
  isMenuShowing: false,
  likelyVariable: null,
};

const popupSlice = createSlice({
  name: "popupSlice",
  initialState,
  reducers: {
    hideMenu(state) {
      state.isMenuShowing = false;
      state.likelyVariable = null;
    },
    showMenuForVariable(state, action: PayloadAction<string | null>) {
      state.isMenuShowing = true;
      state.likelyVariable = action.payload;
    },
    updateVariable(state, action: PayloadAction<string | null>) {
      if (state.isMenuShowing) {
        state.likelyVariable = action.payload;
      }
    },
  },
});

// A bit of hack to determine if we're in a context where autosuggest is supported. Used to prevent autosuggest from
// breaking service configuration.
const selectAnalysisSliceExists = (state: UnknownObject) =>
  Boolean(state.analysis);

/**
 * Hook to attach the variable popup to a field input.
 */
function useAttachPopup({ inputMode, inputElementRef, value }: Props) {
  const analysisSliceExists = useSelector(selectAnalysisSliceExists);
  const { varAutosuggest } = useSelector(selectSettings);
  const [{ isMenuShowing, likelyVariable }, dispatch] = useReducer(
    popupSlice.reducer,
    initialState
  );

  const autosuggestEnabled = varAutosuggest && analysisSliceExists;

  const isMenuAvailable =
    (inputMode === "var" || inputMode === "string") && autosuggestEnabled;

  const updateSelection = (value: string) => {
    if (inputMode !== "var" && inputMode !== "string") {
      return;
    }

    // For string inputs, we always use TextAreas, hence the cast of the ref to HTMLTextAreaElement
    const cursorPosition =
      (inputElementRef.current as HTMLTextAreaElement)?.selectionStart ?? 0;

    if (inputMode === "var") {
      const variableName = getVariableAtPosition(value, cursorPosition);
      dispatch(popupSlice.actions.showMenuForVariable(variableName));
    }

    if (inputMode === "string") {
      const variableName = getLikelyVariableAtPosition(value, cursorPosition, {
        clampPosition: true,
        includeBoundary: true,
      }).name;

      console.debug("getLikelyVariableAtPosition", variableName, {
        value,
        cursorPosition,
      });

      if (variableName) {
        dispatch(popupSlice.actions.showMenuForVariable(variableName));
      } else if (isMenuShowing) {
        dispatch(popupSlice.actions.hideMenu());
      }
    }
  };

  useEffect(() => {
    if (!inputElementRef.current || !isMenuAvailable) {
      return;
    }

    const onClick = () => {
      updateSelection(value);
    };

    const onKeyDown = async (event: KeyboardEvent) => {
      const { key } = event;
      if (key === "ArrowRight" || key === "ArrowLeft") {
        // Ensure the browser has updated the selection in the DOM
        await waitAnimationFrame();

        updateSelection(value);
      } else if ((key === "Escape" || key === "}") && isMenuShowing) {
        dispatch(popupSlice.actions.hideMenu());
      }
    };

    const onKeyPress = (event: KeyboardEvent) => {
      const { key } = event;

      if ((key === "@" || inputMode === "var") && !isMenuShowing) {
        dispatch(popupSlice.actions.showMenuForVariable(null));
      }

      if (key === ".") {
        updateSelection(value);
      }
    };

    const inputElement = inputElementRef.current;
    inputElement.addEventListener("click", onClick);
    inputElement.addEventListener("keypress", onKeyPress);
    inputElement.addEventListener("keydown", onKeyDown);

    return () => {
      inputElement?.removeEventListener("click", onClick);
      inputElement?.removeEventListener("keypress", onKeyPress);
      inputElement?.removeEventListener("keydown", onKeyDown);
    };
  }, [inputElementRef, isMenuAvailable, inputMode, isMenuShowing, value]);

  // Update the likely variable as the user types
  useDebouncedEffect(
    value,
    () => {
      // For performance, ignore typing if menu is not already showing. There's a key down trigger for @ in the
      // TextWidget that will show the popup when the user starts typing a variable
      if (!isMenuShowing || !isMenuAvailable) {
        return;
      }

      updateSelection(value);
    },
    {
      delayMillis: 50,
    }
  );

  return {
    isMenuAvailable,
    isMenuShowing,
    likelyVariable,
    hideMenu() {
      dispatch(popupSlice.actions.hideMenu());
    },
  };
}

export default useAttachPopup;
