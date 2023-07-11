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

import { Transformer } from "@/types/bricks/transformerTypes";
import {
  type BrickArgs,
  type BrickOptions,
  type PipelineExpression,
} from "@/types/runtimeTypes";
import { type Schema } from "@/types/schemaTypes";
import { propertiesToSchema } from "@/validators/generic";
import { validateRegistryId } from "@/types/helpers";

/**
 * A brick that runs one or more bricks synchronously or asynchronously. Used to group bricks and/or develop custom
 * control flow using bricks, e.g.:
 * - Run a brick asynchronously, updating Page State with the loading state
 * - Re-usable custom error handling
 * - Performance tracing
 */
class Run extends Transformer {
  static BLOCK_ID = validateRegistryId("@pixiebrix/run");
  defaultOutputKey = "runOutput";

  constructor() {
    super(
      Run.BLOCK_ID,
      "Run Bricks",
      "Run one or more bricks synchronously or asynchronously"
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
      body: {
        $ref: "https://app.pixiebrix.com/schemas/pipeline#",
        description: "The brick(s) to execute",
      },
      async: {
        type: "boolean",
        title: "Asynchronous",
        description:
          "True to run the brick(s) asynchronously. If true, outputs an empty value immediately",
        default: false,
      },
    },
    ["body"]
  );

  async transform(
    {
      body: bodyPipeline,
      async = false,
    }: BrickArgs<{
      body: PipelineExpression;
      async?: boolean;
    }>,
    options: BrickOptions
  ): Promise<unknown> {
    const promise = options.runPipeline(bodyPipeline, {
      key: "body",
      counter: 0,
    });

    if (async) {
      return {};
    }

    return promise;
  }
}

export default Run;
