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

import { Block } from "@/types";
import { readerFactory } from "@/blocks/readers/factory";
import { Validator, Schema as ValidatorSchema } from "@cfworker/json-schema";
import { ValidationError } from "@/errors";
import { castArray } from "lodash";
import { InitialValues, reducePipeline } from "@/runtime/reducePipeline";
import {
  ApiVersion,
  BlockArg,
  BlockOptions,
  Config,
  IBlock,
  Metadata,
  RegistryId,
  Schema,
} from "@/core";
import { dereference } from "@/validators/generic";
import blockSchema from "@schemas/component.json";
import blockRegistry from "@/blocks/registry";
import { BlockType, getType } from "@/blocks/util";
import { BlockConfig, BlockPipeline } from "@/blocks/types";
import apiVersionOptions from "@/runtime/apiVersionOptions";

type ComponentConfig = {
  apiVersion?: ApiVersion;
  kind: "component";
  metadata: Metadata;
  defaultOptions: Record<string, string>;
  pipeline: BlockConfig | BlockPipeline;
  inputSchema: Schema;
  outputSchema?: Schema;
  // Mapping from `key` -> `serviceId`
  services?: Record<string, RegistryId>;
};

function validateBlockDefinition(
  component: unknown
): asserts component is ComponentConfig {
  const validator = new Validator(
    dereference(blockSchema as Schema) as ValidatorSchema
  );
  const result = validator.validate(component);
  if (!result.valid) {
    console.warn("Invalid block configuration", {
      component,
      result,
    });
    throw new ValidationError("Invalid block configuration", result.errors);
  }
}

class ExternalBlock extends Block {
  public readonly component: ComponentConfig;

  readonly apiVersion: ApiVersion;

  readonly inputSchema: Schema;

  constructor(component: ComponentConfig) {
    const { id, name, description, icon } = component.metadata;
    super(id, name, description, icon);
    this.apiVersion = component.apiVersion ?? "v1";
    this.component = component;
    this.inputSchema = this.component.inputSchema;
    this.outputSchema = this.component.outputSchema;
  }

  override async isPure(): Promise<boolean> {
    const pipeline = castArray(this.component.pipeline);

    const purity = await Promise.all(
      pipeline.map(async (blockConfig) => {
        const resolvedBlock = await blockRegistry.lookup(blockConfig.id);
        return resolvedBlock.isPure();
      })
    );

    return purity.every((x) => x);
  }

  override async isRootAware(): Promise<boolean> {
    const pipeline = castArray(this.component.pipeline);

    const awareness = await Promise.all(
      pipeline.map(async (blockConfig) => {
        const resolvedBlock = await blockRegistry.lookup(blockConfig.id);
        return resolvedBlock.isRootAware();
      })
    );

    return awareness.some((x) => x);
  }

  async inferType(): Promise<BlockType | null> {
    const pipeline = castArray(this.component.pipeline);
    const last = pipeline[pipeline.length - 1];

    try {
      const block = await blockRegistry.lookup(last.id);
      return await getType(block);
    } catch {
      return null;
    }
  }

  async run(arg: BlockArg, options: BlockOptions): Promise<unknown> {
    options.logger.debug("Running component pipeline", {
      arg,
    });

    const initialValues: InitialValues = {
      input: arg,
      // OptionsArgs are set at the blueprint level. For composite bricks, the options should be passed in
      // as part of the brick inputs
      optionsArgs: undefined,
      // Services are passed as inputs to the brick
      serviceContext: undefined,
      root: options.root,
    };

    return reducePipeline(this.component.pipeline, initialValues, {
      logger: options.logger,
      headless: options.headless,
      // The component uses its declared version of the runtime API, regardless of what version of the runtime
      // is used to call the the component
      ...apiVersionOptions(this.component.apiVersion),
    });
  }
}

export function fromJS(component: Config): IBlock {
  if (component.kind == null) {
    throw new ValidationError(
      "Component definition is missing a 'kind' property",
      null
    );
  }

  if (component.kind === "reader") {
    return readerFactory(component);
  }

  validateBlockDefinition(component);
  return new ExternalBlock(component);
}
