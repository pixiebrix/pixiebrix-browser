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

import { type ReaderConfig } from "@/bricks/types";
import blockRegistry from "@/bricks/registry";
import ArrayCompositeReader from "@/bricks/readers/ArrayCompositeReader";
import { isPlainObject, mapValues } from "lodash";
import CompositeReader from "@/bricks/readers/CompositeReader";
import { resolveObj } from "@/utils";
import { BusinessError } from "@/errors/businessErrors";
import { type Reader } from "@/types/bricks/readerTypes";
import { type RegistryId } from "@/types/registryTypes";

export function selectReaderIds(config: ReaderConfig): RegistryId[] {
  if (typeof config === "string") {
    return [config];
  }

  if (Array.isArray(config)) {
    return config.flatMap((x) => selectReaderIds(x));
  }

  if (typeof config === "object") {
    return Object.values(config).flatMap((x) => selectReaderIds(x));
  }

  return [];
}

/** Instantiate a reader from a reader configuration. */
export async function mergeReaders(
  readerConfig: ReaderConfig
): Promise<Reader> {
  if (typeof readerConfig === "string") {
    return blockRegistry.lookup(readerConfig) as Promise<Reader>;
  }

  if (Array.isArray(readerConfig)) {
    return new ArrayCompositeReader(
      await Promise.all(readerConfig.map(async (x) => mergeReaders(x)))
    );
  }

  if (isPlainObject(readerConfig)) {
    return new CompositeReader(
      await resolveObj(mapValues(readerConfig, mergeReaders))
    );
  }

  throw new BusinessError("Unexpected value for readerConfig");
}
