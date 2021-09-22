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

import { IExtension, UUID } from "@/core";
import { FormState } from "@/devTools/editor/slices/editorSlice";
import { useContext } from "react";
import { DevToolsContext } from "@/devTools/context";
import { useAsyncState } from "@/hooks/common";
import {
  checkAvailable,
  getInstalledExtensionPointIds,
} from "@/background/devtools";
import { zip } from "lodash";
import hash from "object-hash";
import { resolveDefinitions } from "@/registry/internal";

export interface InstallState {
  availableInstalledIds: Set<UUID> | undefined;
  availableDynamicIds: Set<UUID> | undefined;
  unavailableCount: number | null;
}

function useInstallState(
  installed: IExtension[],
  elements: FormState[]
): InstallState {
  const {
    port,
    tabState: { navSequence, meta },
  } = useContext(DevToolsContext);

  const [availableInstalledIds] = useAsyncState(async () => {
    if (meta) {
      const extensionPointIds = new Set(
        await getInstalledExtensionPointIds(port)
      );
      const resolved = await Promise.all(
        installed.map(async (extension) => resolveDefinitions(extension))
      );
      const available = resolved
        .filter((x) => extensionPointIds.has(x.extensionPointId))
        .map((x) => x.id);
      return new Set<UUID>(
        installed.filter((x) => available.includes(x.id)).map((x) => x.id)
      );
    }

    return new Set<UUID>();
  }, [port, navSequence, meta]);

  const [availableDynamicIds] = useAsyncState(async () => {
    // At this point, if the extensionPoint is an inner extension point (without its own id), then it will have
    // been expanded to extensionPoint
    if (meta) {
      const availability = await Promise.all(
        elements.map(async (element) =>
          checkAvailable(port, element.extensionPoint.definition.isAvailable)
        )
      );
      return new Set<UUID>(
        zip(elements, availability)
          .filter(([, available]) => available)
          .map(([extension]) => extension.uuid)
      );
    }

    return new Set<UUID>();
  }, [
    port,
    meta,
    navSequence,
    hash(
      elements.map((x) => ({
        uuid: x.uuid,
        isAvailable: x.extensionPoint.definition.isAvailable,
      }))
    ),
  ]);

  return {
    availableInstalledIds,
    availableDynamicIds,
    unavailableCount: meta
      ? installed.length - availableInstalledIds.size
      : null,
  };
}

export default useInstallState;
