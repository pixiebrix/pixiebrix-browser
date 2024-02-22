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

import { useSyncExternalStore } from "use-sync-external-store/shim";
import { useCallback } from "react";
import type CommandRegistry from "@/contentScript/commandPopover/CommandRegistry";
import type { TextCommand } from "@/platform/platformProtocol";

/**
 * React hook to sync React with the text command registry.
 * @param registry the registry to watch
 */
function useCommandRegistry(registry: CommandRegistry): TextCommand[] {
  const subscribe = useCallback(
    (callback: () => void) => {
      registry.onChange.add(callback);
      return () => {
        registry.onChange.remove(callback);
      };
    },
    [registry],
  );

  const getSnapshot = useCallback(() => registry.commands, [registry]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

export default useCommandRegistry;
