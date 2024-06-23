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

import { type ModViewItem } from "@/types/modTypes";
import { useModals } from "@/components/ConfirmationModal";
import { useDeleteStandaloneModDefinitionMutation } from "@/data/service/api";
import {
  getLabel,
  isResolvedModComponent,
  isModDefinition,
} from "@/utils/modUtils";
import useUserAction from "@/hooks/useUserAction";
import { CancelError } from "@/errors/businessErrors";
import { Events } from "@/telemetry/events";

/**
 * Hook returning a user action to delete a standalone mod definition, or null if mod is not a standalone mod.
 */
function useDeleteStandaloneModDefinitionAction(
  modViewItem: ModViewItem,
): (() => void) | null {
  const { mod, sharing, status } = modViewItem;
  const modals = useModals();
  const [deleteStandaloneModDefinition] =
    useDeleteStandaloneModDefinitionMutation();
  const isActive = status === "Active" || status === "Paused";

  const canDelete =
    isResolvedModComponent(mod) &&
    sharing.source.type === "Personal" &&
    // If the status is active, there is still likely a copy of the mod component saved on our server.
    // However, we want the user to have to deactivate the mod before deleting it from the server
    !isActive;

  const deleteMod = useUserAction(
    async () => {
      if (isModDefinition(mod)) {
        return;
      }

      const confirmed = await modals.showConfirmation({
        title: "Permanently Delete?",
        message: "Permanently delete the mod from your account?",
        submitCaption: "Delete",
        cancelCaption: "Back to Safety",
      });

      if (!confirmed) {
        throw new CancelError();
      }

      await deleteStandaloneModDefinition({ extensionId: mod.id }).unwrap();
    },
    {
      successMessage: `Deleted mod ${getLabel(mod)} from your account`,
      errorMessage: `Error deleting mod ${getLabel(mod)} from your account`,
      event: Events.STANDALONE_MOD_DELETE,
    },
    [modals],
  );

  return canDelete ? deleteMod : null;
}

export default useDeleteStandaloneModDefinitionAction;
