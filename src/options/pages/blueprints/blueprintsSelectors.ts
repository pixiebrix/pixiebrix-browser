/*
 * Copyright (C) 2022 PixieBrix, Inc.
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

import { type BlueprintsState } from "@/options/pages/blueprints/blueprintsSlice";

export type BlueprintsRootState = {
  blueprints: BlueprintsState;
};

export const selectView = ({ blueprints }: BlueprintsRootState) =>
  blueprints.view;
export const selectGroupBy = ({ blueprints }: BlueprintsRootState) =>
  blueprints.groupBy;
export const selectSortBy = ({ blueprints }: BlueprintsRootState) =>
  blueprints.sortBy;
export const selectActiveTab = ({ blueprints }: BlueprintsRootState) =>
  blueprints.activeTab;
export const selectSearchQuery = ({ blueprints }: BlueprintsRootState) =>
  blueprints.searchQuery;
