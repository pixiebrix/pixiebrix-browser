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

import {
  isBaseExtensionPanelEntry,
  type SidebarRootState,
} from "@/types/sidebarTypes";
import { isEmpty } from "lodash";
import { eventKeyForEntry } from "@/sidebar/utils";

export const selectIsSidebarEmpty = ({ sidebar }: SidebarRootState) =>
  isEmpty(sidebar.panels) &&
  isEmpty(sidebar.forms) &&
  isEmpty(sidebar.temporaryPanels) &&
  isEmpty(sidebar.staticPanels) &&
  sidebar.recipeToActivate == null;

export const selectSidebarHasModPanels = ({ sidebar }: SidebarRootState) =>
  !isEmpty(sidebar.panels) ||
  !isEmpty(sidebar.forms) ||
  !isEmpty(sidebar.temporaryPanels);

export const selectSidebarActiveTabKey = ({ sidebar }: SidebarRootState) =>
  sidebar.activeKey;

export const selectSidebarPanels = ({ sidebar }: SidebarRootState) =>
  sidebar.panels;

export const selectSidebarForms = ({ sidebar }: SidebarRootState) =>
  sidebar.forms;

export const selectSidebarTemporaryPanels = ({ sidebar }: SidebarRootState) =>
  sidebar.temporaryPanels;

export const selectSidebarStaticPanels = ({ sidebar }: SidebarRootState) =>
  sidebar.staticPanels;

export const selectSidebarRecipeToActivate = ({ sidebar }: SidebarRootState) =>
  sidebar.recipeToActivate;

export const selectExtensionFromEventKey =
  ({ options, sidebar }: SidebarRootState) =>
  (eventKey: string) => {
    const sidebarEntries = [
      ...sidebar.panels,
      ...sidebar.forms,
      ...sidebar.temporaryPanels,
      ...sidebar.staticPanels,
      sidebar.recipeToActivate,
    ];

    // Get sidebar entry by event key
    const sidebarEntry = sidebarEntries.find(
      (entry) => eventKeyForEntry(entry) === eventKey
    );

    const { extensionId } =
      isBaseExtensionPanelEntry(sidebarEntry) && sidebarEntry;

    return options.extensions.find((extension) => extension.id === extensionId);
  };
