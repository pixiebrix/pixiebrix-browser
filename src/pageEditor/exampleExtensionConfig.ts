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

import { type BrickPipeline } from "@/blocks/types";
import { type StarterBrickType } from "@/extensionPoints/types";
import { validateRegistryId } from "@/types/helpers";
import {
  createNewBlock,
  getExampleBlockConfig,
} from "@/pageEditor/exampleBlockConfigs";
import { validateOutputKey } from "@/runtime/runtimeTypes";

const documentBlockId = validateRegistryId("@pixiebrix/document");
const quickbarActionId = validateRegistryId("@pixiebrix/quickbar/add");
const tourStepBlockId = validateRegistryId("@pixiebrix/tour/step");

export function getExampleBlockPipeline(type: StarterBrickType): BrickPipeline {
  if (type === "actionPanel") {
    const documentBuilderBlock = createNewBlock(documentBlockId);
    return [documentBuilderBlock];
  }

  if (type === "quickBarProvider") {
    const quickbarActionBlock = createNewBlock(quickbarActionId);
    quickbarActionBlock.config = {
      title: "Example Action",
      action: {
        __type__: "pipeline",
        __value__: [],
      },
    };
    return [quickbarActionBlock];
  }

  if (type === "tour") {
    const tourStepBlock = createNewBlock(tourStepBlockId);
    tourStepBlock.outputKey = validateOutputKey("step");
    tourStepBlock.config = getExampleBlockConfig(tourStepBlockId);

    return [tourStepBlock];
  }

  return [];
}
