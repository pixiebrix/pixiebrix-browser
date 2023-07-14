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

import { uuidv4 } from "@/types/helpers";
import {
  type BrickConfig,
  type BrickPipeline,
  type BrickPosition,
} from "@/bricks/types";
import { produce } from "immer";
import { type WritableDraft } from "immer/dist/types/types-external";
import PipelineVisitor, {
  ROOT_POSITION,
  type VisitResolvedBlockExtra,
} from "@/bricks/PipelineVisitor";
import pipelineSchema from "@schemas/pipeline.json";
import { PipelineFlavor } from "@/pageEditor/pageEditorTypes";
import blockRegistry, { type TypedBlockMap } from "@/bricks/registry";
import { isPipelineExpression } from "@/utils/expressionUtils";

class NormalizePipelineVisitor extends PipelineVisitor {
  constructor(private readonly blockMap: TypedBlockMap) {
    super();
  }

  override visitBrick(
    position: BrickPosition,
    blockConfig: BrickConfig,
    extra: VisitResolvedBlockExtra
  ): void {
    // Generate an instanceId for the block
    blockConfig.instanceId = uuidv4();

    // Initialize empty sub pipelines
    const typedBlock = this.blockMap.get(blockConfig.id);

    if (typedBlock == null) {
      console.warn(
        "Brick not found in block map: %s",
        blockConfig.id,
        this.blockMap
      );
    } else {
      const propertiesSchema = typedBlock.block?.inputSchema?.properties ?? {};
      const emptySubPipelineProperties = Object.entries(propertiesSchema)
        .filter(
          ([prop, fieldSchema]) =>
            typeof fieldSchema === "object" &&
            fieldSchema.$ref === pipelineSchema.$id &&
            !isPipelineExpression(blockConfig.config[prop])
        )
        .map(([prop]) => prop);

      for (const prop of emptySubPipelineProperties) {
        blockConfig.config[prop] = {
          __type__: "pipeline",
          __value__: [],
        };
      }
    }

    super.visitBrick(position, blockConfig, extra);
  }
}

/**
 * Enrich a BrickPipeline with instanceIds for use in tracing
 * and normalize sub pipelines
 */
export async function normalizePipelineForEditor(
  pipeline: BrickPipeline
): Promise<BrickPipeline> {
  const blockMap = await blockRegistry.allTyped();
  return produce(pipeline, (pipeline: WritableDraft<BrickPipeline>) => {
    new NormalizePipelineVisitor(blockMap).visitPipeline(
      ROOT_POSITION,
      pipeline,
      {
        flavor: PipelineFlavor.AllBlocks,
      }
    );
  });
}

class OmitEditorMetadataVisitor extends PipelineVisitor {
  override visitBrick(
    position: BrickPosition,
    blockConfig: BrickConfig,
    extra: VisitResolvedBlockExtra
  ): void {
    // Remove up instanceIds
    delete blockConfig.instanceId;

    super.visitBrick(position, blockConfig, extra);
  }
}

/**
 * Remove the automatically generated tracing ids.
 */
export function omitEditorMetadata(pipeline: BrickPipeline): BrickPipeline {
  return produce(pipeline, (pipeline: WritableDraft<BrickPipeline>) => {
    new OmitEditorMetadataVisitor().visitPipeline(ROOT_POSITION, pipeline, {
      flavor: PipelineFlavor.AllBlocks,
    });
  });
}
