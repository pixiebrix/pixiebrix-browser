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
import { BlockPipeline } from "@/blocks/types";
import { isPipelineExpression } from "@/runtime/mapArgs";
import { produce } from "immer";
import { WritableDraft } from "immer/dist/types/types-external";
import { traversePipeline } from "@/pageEditor/utils";
import { get, set } from "lodash";

/**
 * Enrich a BlockPipeline with instanceIds for use in tracing
 * and normalize sub pipelines
 */
export function normalizePipelineForEditor(
  pipeline: BlockPipeline
): BlockPipeline {
  return produce(pipeline, (pipeline: WritableDraft<BlockPipeline>) => {
    traversePipeline({
      pipeline,
      visitBlock({ blockConfig }) {
        blockConfig.instanceId = uuidv4();
      },
      preVisitSubPipeline({ parentBlock, subPipelineProperty }) {
        const subPipeline = get(parentBlock, subPipelineProperty);
        if (!isPipelineExpression(subPipeline)) {
          set(parentBlock, subPipelineProperty, {
            __type__: "pipeline",
            __value__: [],
          });
        }
      },
    });
  });
}

/**
 * Remove the automatically generated tracing ids.
 */
export function omitEditorMetadata(pipeline: BlockPipeline): BlockPipeline {
  return produce(pipeline, (pipeline: WritableDraft<BlockPipeline>) => {
    traversePipeline({
      pipeline,
      visitBlock({ blockConfig }) {
        delete blockConfig.instanceId;
      },
    });
  });
}
