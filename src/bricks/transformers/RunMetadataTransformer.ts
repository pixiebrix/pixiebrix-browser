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

import { TransformerABC } from "@/types/bricks/transformerTypes";
import type { BrickArgs, BrickOptions } from "@/types/runtimeTypes";
import { type Schema, SCHEMA_EMPTY_OBJECT } from "@/types/schemaTypes";
import { propertiesToSchema } from "@/validators/generic";
import { validateRegistryId } from "@/types/helpers";

/**
 * Returns metadata for the current run.
 *
 * Introduced to support providing context for audit use cases.
 *
 * @since 1.8.6
 */
class RunMetadataTransformer extends TransformerABC {
  static BRICK_ID = validateRegistryId("@pixiebrix/reflect/run-metadata");

  constructor() {
    super(
      "@pixiebrix/reflect/run-metadata",
      "[Experimental] Run Metadata",
      "Returns metadata for the current run",
    );
  }

  override defaultOutputKey = "meta";

  inputSchema: Schema = SCHEMA_EMPTY_OBJECT;

  override async isPure(): Promise<boolean> {
    return true;
  }

  override async isRootAware(): Promise<boolean> {
    return false;
  }

  override outputSchema: Schema = propertiesToSchema(
    {
      modComponentId: {
        type: "string",
        format: "uuid",
        description: "The mod component id",
      },
      runId: {
        type: ["string", "null"],
        format: "uuid",
        description: "The run id, or null if run id is not tracked for run",
      },
      mod: {
        type: ["object", "null"],
        description: "Mod metadata, or null if not running in a packaged mod",
        properties: {
          id: {
            type: "string",
            description: "The mod registry id",
          },
          version: {
            type: "string",
            description: "The mod version",
          },
        },
        required: ["id", "version"],
      },
      deploymentId: {
        type: ["string", "null"],
        format: "uuid",
        description:
          "The deployment id, or null if not running as part of a deployment",
      },
    },
    ["modComponentId"],
  );

  async transform(
    _args: BrickArgs<unknown>,
    { logger, meta }: BrickOptions,
  ): Promise<unknown> {
    const { context } = logger;

    return {
      mod:
        context.blueprintId == null
          ? null
          : {
              id: context.blueprintId,
              version: context.blueprintVersion,
            },
      deploymentId: context.deploymentId ?? null,
      modComponentId: context.extensionId,
      runId: meta.runId,
    };
  }
}

export default RunMetadataTransformer;
