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

import AnalysisVisitor from "@/analysis/AnalysisVisitor";
import { AnnotationType } from "@/analysis/analysisTypes";
import { BlockConfig, BlockPosition } from "@/blocks/types";
import { VisitBlockExtra } from "@/blocks/PipelineVisitor";
import { TypedBlockMap } from "@/blocks/registry";
import { makeIsBlockAllowedForPipeline } from "@/pageEditor/tabs/editTab/blockFilterHelpers";
import { FormState } from "@/pageEditor/extensionPoints/formStateTypes";
import blockRegistry from "@/blocks/registry";

class BlockTypeAnalysis extends AnalysisVisitor {
  private allBlocks: TypedBlockMap;

  get id() {
    return "blockType";
  }

  override visitBlock(
    position: BlockPosition,
    blockConfig: BlockConfig,
    extra: VisitBlockExtra
  ) {
    super.visitBlock(position, blockConfig, extra);

    const typedBlock = this.allBlocks.get(blockConfig.id);
    const isBlockAllowed = makeIsBlockAllowedForPipeline(extra.pipelineFlavor)(
      typedBlock
    );

    if (!isBlockAllowed) {
      this.annotations.push({
        position,
        message: `Block of type "${typedBlock.type}" is not allowed in this pipeline`,
        analysisId: this.id,
        type: AnnotationType.Error,
      });
    }
  }

  override async run(extension: FormState): Promise<void> {
    this.allBlocks = await blockRegistry.allTyped();

    super.run(extension);
  }
}

export default BlockTypeAnalysis;
