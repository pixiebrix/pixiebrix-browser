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

import { EmptyConfig, IExtension, IExtensionPoint, UUID } from "@/core";
import { liftContentScript } from "@/contentScript/backgroundProtocol";
import {
  clearDynamic,
  getInstalledIds,
  runDynamic,
} from "@/contentScript/lifecycle";
import { fromJS as extensionPointFactory } from "@/extensionPoints/factory";
import Overlay from "@/nativeEditor/Overlay";
import { checkAvailable as _checkAvailable } from "@/blocks/available";
import {
  ExtensionPointConfig,
  ExtensionPointDefinition,
} from "@/extensionPoints/types";
import { ElementType } from "@/devTools/editor/extensionPoints/elementConfig";
import { resolveDefinitions } from "@/registry/internal";

export interface DynamicDefinition<
  TExtensionPoint extends ExtensionPointDefinition = ExtensionPointDefinition,
  TExtension extends EmptyConfig = EmptyConfig
> {
  type: ElementType;
  extensionPoint: ExtensionPointConfig<TExtensionPoint>;
  extension: IExtension<TExtension>;
}

let _overlay: Overlay | null = null;
const _temporaryExtensions: Map<string, IExtensionPoint> = new Map();

export const clear = liftContentScript(
  "CLEAR_DYNAMIC",
  async ({ uuid }: { uuid?: UUID }) => {
    clearDynamic(uuid);
    if (uuid) {
      _temporaryExtensions.delete(uuid);
    } else {
      _temporaryExtensions.clear();
    }
  }
);

export const getInstalledExtensionPointIds = liftContentScript(
  "INSTALLED_EXTENSIONS",
  async () => getInstalledIds()
);

export const updateDynamicElement = liftContentScript(
  "UPDATE_DYNAMIC_ELEMENT",
  async ({
    extensionPoint: extensionPointConfig,
    extension: extensionConfig,
  }: DynamicDefinition) => {
    const extensionPoint = extensionPointFactory(extensionPointConfig);

    _temporaryExtensions.set(extensionConfig.id, extensionPoint);

    clearDynamic(extensionConfig.id, { clearTrace: false });

    // In practice, should be a no-op because the page editor handles the extensionPoint
    const resolved = await resolveDefinitions(extensionConfig);

    extensionPoint.addExtension(resolved);
    await runDynamic(extensionConfig.id, extensionPoint);
  }
);

export const enableOverlay = liftContentScript(
  "ENABLE_OVERLAY",
  async (selector: string) => {
    if (!selector) {
      throw new Error(`Selector not found: ${selector}`);
    }

    if (_overlay == null) {
      _overlay = new Overlay();
    }

    // eslint-disable-next-line unicorn/no-array-callback-reference -- false positive on JQuery method
    const $elt = $(document).find(selector);
    _overlay.inspect($elt.toArray(), null);
  }
);

export const disableOverlay = liftContentScript("DISABLE_OVERLAY", async () => {
  if (_overlay != null) {
    _overlay.remove();
    _overlay = null;
  }
});

export const checkAvailable = liftContentScript(
  "CHECK_AVAILABLE",
  _checkAvailable
);
