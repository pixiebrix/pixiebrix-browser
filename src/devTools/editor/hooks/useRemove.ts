/*
 * Copyright (C) 2021 PixieBrix, Inc.
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

import { actions, FormState } from "@/devTools/editor/editorSlice";
import { useCallback, useContext } from "react";
import { DevToolsContext } from "@/devTools/context";
import { useToasts } from "react-toast-notifications";
import { useFormikContext } from "formik";
import { useDispatch } from "react-redux";
import { useModals } from "@/components/ConfirmationModal";
import { uninstallContextMenu } from "@/background/devtools";
import * as nativeOperations from "@/background/devtools";
import { optionsSlice } from "@/options/slices";
import { reportError } from "@/telemetry/logging";
import { getErrorMessage } from "@/errors";

function useRemove(element: FormState): () => void {
  const { port } = useContext(DevToolsContext);
  const { addToast } = useToasts();
  const { values } = useFormikContext<FormState>();
  const dispatch = useDispatch();
  const { showConfirmation } = useModals();

  return useCallback(async () => {
    console.debug(`pageEditor: remove element ${element.uuid}`);

    const confirm = await showConfirmation({
      title: "Remove Brick?",
      message: "This action cannot be undone",
      submitCaption: "Remove",
    });

    if (!confirm) {
      return;
    }

    try {
      if (element.type === "contextMenu") {
        try {
          await uninstallContextMenu(port, { extensionId: element.uuid });
        } catch (error: unknown) {
          // The context menu may not currently be registered if it's not on a page that has a contentScript
          // with a pattern that matches
          console.info("Cannot unregister contextMenu", { error });
        }
      }

      try {
        await nativeOperations.clearDynamicElements(port, {
          uuid: element.uuid,
        });
      } catch (error: unknown) {
        // Element might not be on the page anymore
        console.info("Cannot clear dynamic element from page", { error });
      }

      if (values.installed) {
        dispatch(
          optionsSlice.actions.removeExtension({
            extensionPointId: values.extensionPoint.metadata.id,
            extensionId: values.uuid,
          })
        );
      }

      dispatch(actions.removeElement(element.uuid));
    } catch (error: unknown) {
      reportError(error);
      addToast(`Error removing element: ${getErrorMessage(error)}`, {
        appearance: "error",
        autoDismiss: true,
      });
    }
  }, [showConfirmation, values, addToast, port, element, dispatch]);
}

export default useRemove;
