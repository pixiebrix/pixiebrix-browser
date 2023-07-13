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
import { useState } from "react";
import useUpsertFormElement from "@/pageEditor/hooks/useUpsertFormElement";
import { selectSessionId } from "@/pageEditor/slices/sessionSelectors";
import { reportEvent } from "@/telemetry/events";
import notify from "@/utils/notify";
import { type ModComponentFormState } from "@/pageEditor/extensionPoints/formStateTypes";

type ExtensionSaver = {
  save: (element: ModComponentFormState) => Promise<void>;
  isSaving: boolean;
};

function useSaveExtension(): ExtensionSaver {
  const [isSaving, setIsSaving] = useState(false);
  const create = useUpsertFormElement();
  const sessionId = useSelector(selectSessionId);

  async function save(element: ModComponentFormState): Promise<void> {
    setIsSaving(true);

    try {
      const error = await create({
        element,
        options: {
          pushToCloud: true,
          checkPermissions: true,
          notifySuccess: true,
          reactivateEveryTab: true,
        },
      });

      if (error) {
        notify.error(error);
      } else {
        reportEvent("PageEditorSave", {
          sessionId,
          extensionId: element.uuid,
        });
      }
    } finally {
      setIsSaving(false);
    }
  }

  return {
    save,
    isSaving,
  };
}

export default useSaveExtension;
