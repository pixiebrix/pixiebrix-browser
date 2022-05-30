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

import { uuidv4 } from "@/types/helpers";
import { BlockConfig, BlockPipeline } from "@/blocks/types";
import ForEach from "@/blocks/transformers/controlFlow/ForEach";
import IfElse from "@/blocks/transformers/controlFlow/IfElse";
import TryExcept from "@/blocks/transformers/controlFlow/TryExcept";
import { isPipelineExpression } from "@/runtime/mapArgs";
import { produce } from "immer";
import { WritableDraft } from "immer/dist/types/types-external";

/**
 * Normalize the Block and invoke normalization for the sub pipelines
 */
function normalizeBlockDraft(
  block: WritableDraft<BlockConfig>,
  pipelineProps: string[] = []
) {
  block.instanceId = uuidv4();

  for (const prop of pipelineProps) {
    const pipeline = block.config[prop];
    if (isPipelineExpression(pipeline)) {
      pipeline.__value__ = normalizePipeline(pipeline.__value__);
    } else {
      // Normalizing am empty pipeline
      block.config[prop] = {
        __type__: "pipeline",
        __value__: [],
      };
    }
  }
}

/**
 * Find the sub pipelines in every block of the given pipeline
 */
function normalizePipelineDraft(pipeline: WritableDraft<BlockPipeline>) {
  for (const block of pipeline) {
    switch (block.id) {
      case ForEach.BLOCK_ID:
        normalizeBlockDraft(block, ["body"]);
        break;

      case IfElse.BLOCK_ID:
        normalizeBlockDraft(block, ["if", "else"]);
        break;

      case TryExcept.BLOCK_ID:
        normalizeBlockDraft(block, ["try", "except"]);
        break;

      default:
        normalizeBlockDraft(block);
    }
  }
}

/**
 * Enrich a BlockPipeline with instanceIds for use in tracing
 * and normalize sub pipelines
 */
export function normalizePipeline(pipeline: BlockPipeline): BlockPipeline {
  return produce(pipeline, normalizePipelineDraft);
}
