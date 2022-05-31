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

import { Transformer } from "@/types";
import { BlockArg, BlockOptions, OutputKey, Schema } from "@/core";
import { propertiesToSchema } from "@/validators/generic";
import { validateOutputKey } from "@/runtime/runtimeTypes";
import { PipelineExpression } from "@/runtime/mapArgs";
import { validateRegistryId } from "@/types/helpers";

class ForEach extends Transformer {
  static BLOCK_ID = validateRegistryId("@pixiebrix/for-each");
  defaultOutputKey = "result";

  constructor() {
    super(
      ForEach.BLOCK_ID,
      "For-Each Loop",
      "Loop over elements in a list/array, returning the value of the last iteration"
    );
  }

  override async isPure(): Promise<boolean> {
    // Safe default -- need to be able to inspect the inputs to determine if pure
    return false;
  }

  override async isRootAware(): Promise<boolean> {
    // Safe default -- need to be able to inspect the inputs to determine if any sub-calls are root aware
    return true;
  }

  inputSchema: Schema = propertiesToSchema(
    {
      elements: {
        type: "array",
        description: "A list/array of elements to loop over",
      },
      body: {
        $ref: "https://app.pixiebrix.com/schemas/pipeline#",
        description: "The bricks to execute for each element",
      },
      elementKey: {
        type: "string",
        default: "element",
      },
    },
    ["elements", "body"]
  );

  async transform(
    {
      elements,
      body: bodyPipeline,
      elementKey = validateOutputKey("element"),
    }: BlockArg<{
      elements: unknown[];
      body: PipelineExpression;
      elementKey: OutputKey;
    }>,
    options: BlockOptions
  ): Promise<unknown> {
    let last: unknown;

    for (const element of elements) {
      // eslint-disable-next-line no-await-in-loop -- synchronous for-loop brick
      last = await options.runPipeline(bodyPipeline.__value__, {
        [`@${elementKey}`]: element,
      });
    }

    return last;
  }
}

export default ForEach;
