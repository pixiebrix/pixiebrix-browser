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

import { castArray } from "lodash";
import { MessageContext, Schema } from "@/core";
import { BusinessError } from "@/errors";
import { OutputUnit } from "@cfworker/json-schema";
import { BlockConfig, BlockPipeline } from "@/blocks/combinators";

export class PipelineConfigurationError extends Error {
  readonly config: BlockPipeline;

  constructor(message: string, config: BlockConfig | BlockPipeline) {
    super(message);
    this.name = "PipelineConfigurationError";
    this.config = castArray(config);
  }
}

/**
 * Error bailing if a renderer component is encountered while running in "headless mode"
 *
 * Headless mode is used when the content script should run a script, but that the result will be rendered in a
 * different browser context (e.g., the PixieBrix sidebar)
 */
export class HeadlessModeError extends Error {
  public readonly blockId: string;
  public readonly args: unknown;
  public readonly ctxt: unknown;
  public readonly loggerContext: MessageContext;

  constructor(
    blockId: string,
    args: unknown,
    ctxt: unknown,
    loggerContext: MessageContext
  ) {
    super(`${blockId} is a renderer`);
    this.name = "HeadlessModeError";
    this.blockId = blockId;
    this.args = args;
    this.ctxt = ctxt;
    this.loggerContext = loggerContext;
  }
}

/**
 * Error indicating input elements to a block did not match the schema.
 */
export class InputValidationError extends BusinessError {
  readonly schema: Schema;
  readonly input: unknown;
  readonly errors: OutputUnit[];

  constructor(
    message: string,
    schema: Schema,
    input: unknown,
    errors: OutputUnit[]
  ) {
    super(message);
    this.name = "InputValidationError";
    this.schema = schema;
    this.input = input;
    this.errors = errors;
  }
}
