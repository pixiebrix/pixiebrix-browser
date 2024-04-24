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

import { type ModComponentBase } from "@/types/modComponentTypes";
import { type ModComponentFormState } from "@/pageEditor/starterBricks/formStateTypes"; // Part of cycle
import type { Metadata } from "@/types/registryTypes";
import type { UUID } from "@/types/stringTypes";

export type ModComponentSidebarItem = ModComponentBase | ModComponentFormState;

export type ModSidebarItem = {
  modMetadata: Metadata;
  modComponents: ModComponentSidebarItem[];
};

export type SidebarItem = ModSidebarItem | ModComponentSidebarItem;

export function getLabel(extension: ModComponentFormState): string {
  return extension.label ?? extension.extensionPoint.metadata.name;
}

export function isModComponentBase(
  value: ModComponentSidebarItem,
): value is ModComponentBase {
  return "extensionPointId" in value;
}

export function getModComponentItemId(item: ModComponentSidebarItem): UUID {
  return isModComponentBase(item) ? item.id : item.uuid;
}

export function isModSidebarItem(item: SidebarItem): item is ModSidebarItem {
  return "modMetadata" in item;
}
