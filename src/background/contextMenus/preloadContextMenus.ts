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

import { ContextError } from "@/errors/genericErrors";
import { resolveExtensionInnerDefinitions } from "@/registry/internal";
import { ContextMenuStarterBrickABC } from "@/starterBricks/contextMenu/contextMenu";
import { type ContextMenuConfig } from "@/starterBricks/contextMenu/types";
import { selectEventData } from "@/telemetry/deployments";
import {
  type ModComponentBase,
  type ResolvedModComponent,
} from "@/types/modComponentTypes";
import { expectContext } from "@/utils/expectContext";
import { allSettled } from "@/utils/promiseUtils";
import extensionPointRegistry from "@/starterBricks/registry";

/**
 * Add context menu items to the Chrome context menu on all tabs, in anticipation that on Page Load, the content
 * script will register a handler for the item.
 * @param extensions the ModComponent to preload.
 */
export async function preloadContextMenus(
  extensions: ModComponentBase[],
): Promise<void> {
  expectContext("background");
  const promises = extensions.map(async (definition) => {
    const resolved = await resolveExtensionInnerDefinitions(definition);

    const extensionPoint = await extensionPointRegistry.lookup(
      resolved.extensionPointId,
    );
    if (extensionPoint instanceof ContextMenuStarterBrickABC) {
      await extensionPoint.registerMenuItem(
        definition as unknown as ResolvedModComponent<ContextMenuConfig>,
        () => {
          throw new ContextError(
            "Context menu was preloaded, but no handler was registered",
            {
              context: selectEventData(resolved),
            },
          );
        },
      );
    }
  });
  await allSettled(promises, { catch: "ignore" });
}
