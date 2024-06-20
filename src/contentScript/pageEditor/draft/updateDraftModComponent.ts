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

import {
  clearEditorExtension,
  runEditorExtension,
} from "@/contentScript/lifecycle";
import { fromJS as starterBrickFactory } from "@/starterBricks/factory";
import { resolveExtensionInnerDefinitions } from "@/registry/internal";
import { expectContext } from "@/utils/expectContext";
import { type TriggerDefinition } from "@/starterBricks/trigger/triggerStarterBrick";
import type { DraftModComponent } from "@/contentScript/pageEditor/types";
import {
  activateExtensionPanel,
  showSidebar,
} from "@/contentScript/sidebarController";
import { type TourDefinition } from "@/starterBricks/tour/types";
import { isLoadedInIframe } from "@/utils/iframeUtils";

export async function updateDraftModComponent({
  extensionPointConfig,
  extension: extensionConfig,
}: DraftModComponent): Promise<void> {
  expectContext("contentScript");

  // Iframes should not attempt to control the sidebar
  // https://github.com/pixiebrix/pixiebrix-extension/pull/8226
  if (
    isLoadedInIframe() &&
    extensionPointConfig.definition.type === "actionPanel"
  ) {
    return;
  }

  // HACK: adjust behavior when using the Page Editor
  if (extensionPointConfig.definition.type === "trigger") {
    // Prevent auto-run of interval trigger when using the Page Editor because you lose track of trace across runs
    const triggerDefinition =
      extensionPointConfig.definition as TriggerDefinition;
    if (triggerDefinition.trigger === "interval") {
      // OK to assign directly since the object comes from the messenger (so we have a fresh object)
      triggerDefinition.trigger = "load";
    }
  } else if (extensionPointConfig.definition.type === "tour") {
    // Prevent auto-run of tour when using the Page Editor
    const tourDefinition = extensionPointConfig.definition as TourDefinition;
    tourDefinition.autoRunSchedule = "never";
  }

  const starterBrick = starterBrickFactory(extensionPointConfig);

  // Don't clear actionPanel because it causes flicking between the tabs in the sidebar. The updated draft mod component
  // will automatically replace the old panel because the panels are keyed by extension id
  if (starterBrick.kind !== "actionPanel") {
    clearEditorExtension(extensionConfig.id, { clearTrace: false });
  }

  // In practice, should be a no-op because the Page Editor handles the extensionPoint
  const resolved = await resolveExtensionInnerDefinitions(extensionConfig);

  starterBrick.registerModComponent(resolved);
  await runEditorExtension(extensionConfig.id, starterBrick);

  if (starterBrick.kind === "actionPanel") {
    await showSidebar();
    await activateExtensionPanel(extensionConfig.id);
  }
}
