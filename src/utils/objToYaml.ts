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

import { sortBy, fromPairs } from "lodash";
import { removeUndefined } from "@/utils";
import { dump } from "js-yaml";

export const objToYaml = (obj: Record<string, unknown>) =>
  dump(removeUndefined(obj), {
    quotingType: '"',
  });

function orderKeys<T extends Record<string, unknown>>(
  obj: T,
  keys: Array<keyof T>
): T {
  const lookup = new Map(keys.map((key, index) => [key, index]));
  return fromPairs(
    sortBy(Object.entries(obj), ([key]) => lookup.get(key) ?? keys.length)
  ) as T;
}

export const brickToYaml = (brickConfig: Record<string, unknown>) =>
  objToYaml(
    orderKeys(brickConfig, [
      "apiVersion",
      "kind",
      "metadata",
      "inputSchema",
      "outputSchema",
    ])
  );
