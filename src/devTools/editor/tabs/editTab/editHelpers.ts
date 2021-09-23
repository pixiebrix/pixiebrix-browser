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

import { IBlock, OutputKey, RegistryId, SafeString } from "@/core";
import { BlockType, getType } from "@/blocks/util";
import { freshIdentifier } from "@/utils";
import { FormState } from "@/devTools/editor/slices/editorSlice";
import { castArray } from "lodash";
import { BlockPipeline } from "@/blocks/types";
import { selectReaderIds } from "@/blocks/readers/readerUtils";

export function collectRegistryIds(form: FormState): RegistryId[] {
  const extension = form.extension as any;
  const pipeline = castArray(
    extension.action ?? extension.body ?? []
  ) as BlockPipeline;

  return [
    form.extensionPoint.metadata.id,
    ...selectReaderIds(form.extensionPoint.definition.reader),
    ...form.services.map((x) => x.id),
    ...pipeline.map((x) => x.id),
  ];
}

export function showOutputKey(blockType: BlockType): boolean {
  return blockType !== "effect" && blockType !== "renderer";
}

/**
 * Generate a fresh outputKey for `block`
 * @param block the block
 * @param outputKeys existing outputKeys already being used
 */
export async function generateFreshOutputKey(
  block: IBlock,
  outputKeys: OutputKey[]
): Promise<OutputKey | undefined> {
  const type = await getType(block);

  if (!showOutputKey(type)) {
    // Output keys for effects are ignored by the runtime (and generate a warning at runtime)
    return undefined;
  }

  if (block.defaultOutputKey) {
    return freshIdentifier(
      block.defaultOutputKey as SafeString,
      outputKeys
    ) as OutputKey;
  }

  if (type === "reader") {
    return freshIdentifier("data" as SafeString, outputKeys) as OutputKey;
  }

  if (type === "transform") {
    return freshIdentifier(
      "transformed" as SafeString,
      outputKeys
    ) as OutputKey;
  }

  return freshIdentifier(type as SafeString, outputKeys) as OutputKey;
}
