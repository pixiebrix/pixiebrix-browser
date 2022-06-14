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

import { DynamicPath } from "@/components/documentBuilder/documentBuilderTypes";
import { Branch } from "@/blocks/types";

/**
 * Join parts of a document builder element name, ignoring null/blank parts.
 * @param nameParts the parts of the name
 */
export function joinElementName(...nameParts: Array<string | number>): string {
  // Don't use lodash.compact and lodash.isEmpty since they treat 0 as falsy
  return nameParts.filter((x) => x != null && x !== "").join(".");
}

export function mapPathToTraceBranches(tracePath: DynamicPath): Branch[] {
  return tracePath.branches.map(({ staticId, index }) => ({
    key: staticId,
    counter: index,
  }));
}
