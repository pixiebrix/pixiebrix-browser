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

import { type ModComponentBase } from "@/types/extensionTypes";
import { type ComponentFormState } from "@/pageEditor/extensionPoints/formStateTypes";

type SidebarItem = ModComponentBase | ComponentFormState;

export function getLabel(extension: ComponentFormState): string {
  return extension.label ?? extension.extensionPoint.metadata.name;
}

export function isExtension(value: SidebarItem): value is ModComponentBase {
  return "extensionPointId" in value;
}
