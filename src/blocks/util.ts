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

import { IBlock, IService } from "@/core";

export type BlockType = "reader" | "effect" | "transform" | "renderer";

export async function getType(
  block: IBlock | IService
): Promise<BlockType | null> {
  if ("inferType" in block) {
    return await (block as any).inferType();
  } else if ("read" in block) {
    return "reader";
  } else if ("effect" in block) {
    return "effect";
  } else if ("transform" in block) {
    return "transform";
  } else if ("render" in block) {
    return "renderer";
  } else {
    return null;
  }
}
