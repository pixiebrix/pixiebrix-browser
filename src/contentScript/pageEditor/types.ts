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
  type StarterBrickConfig,
  type StarterBrickDefinition,
} from "@/starterBricks/types";
import { type StarterBrickType } from "@/types/starterBrickTypes";
import { type Except } from "type-fest";
import {
  type PanelConfig,
  type PanelDefinition,
} from "@/starterBricks/panelExtension";
import {
  type MenuDefinition,
  type MenuItemStarterBrickConfig,
} from "@/starterBricks/menuItemExtension";
import { type ElementInfo } from "@/utils/inference/selectorTypes";
import { type ModComponentBase } from "@/types/modComponentTypes";
import { type UUID } from "@/types/stringTypes";

export interface DynamicDefinition<
  TExtensionPoint extends StarterBrickDefinition = StarterBrickDefinition,
  TExtension extends UnknownObject = UnknownObject,
> {
  type: StarterBrickType;
  extensionPointConfig: StarterBrickConfig<TExtensionPoint>;
  extension: ModComponentBase<TExtension>;
}

export type SelectMode = "element" | "container";
export type PanelSelectionResult = {
  uuid: UUID;
  foundation: Except<
    PanelDefinition,
    "defaultOptions" | "isAvailable" | "reader"
  >;
  panel: Except<PanelConfig, "body">;
  containerInfo: ElementInfo;
};
export type ButtonDefinition = DynamicDefinition<
  MenuDefinition,
  MenuItemStarterBrickConfig
>;
export type ButtonSelectionResult = {
  uuid: UUID;
  menu: Except<MenuDefinition, "defaultOptions" | "isAvailable" | "reader">;
  item: Pick<MenuItemStarterBrickConfig, "caption">;
  containerInfo: ElementInfo;
};

export type AttributeExample = {
  name: string;
  value: string;
};
