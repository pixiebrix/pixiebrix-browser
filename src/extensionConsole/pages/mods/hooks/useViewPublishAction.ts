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

import { type ModViewItem } from "@/types/modTypes";
import { useDispatch } from "react-redux";
import { getPackageId, isExtension, isModDefinition } from "@/utils/modUtils";
import {
  modModalsSlice,
  type PublishContext,
} from "@/extensionConsole/pages/mods/modals/modModalsSlice";

function useViewPublishAction(modViewItem: ModViewItem): () => void | null {
  const { mod, unavailable, sharing } = modViewItem;
  const isDeployment = sharing.source.type === "Deployment";

  const dispatch = useDispatch();
  const viewPublish = () => {
    const publishContext: PublishContext = isModDefinition(mod)
      ? {
          blueprintId: getPackageId(mod),
        }
      : {
          extensionId: mod.id,
        };

    dispatch(modModalsSlice.actions.setPublishContext(publishContext));
  };

  const showPublishAction =
    !unavailable &&
    // Deployment sharing is controlled via the Admin Console
    !isDeployment &&
    // Extensions can be published
    (isExtension(mod) ||
      // In case of blueprint, skip if it is already published
      sharing.listingId == null);

  return showPublishAction ? viewPublish : null;
}

export default useViewPublishAction;
