import ConsoleLogger from "@/tests/ConsoleLogger";
import { Block, UnknownObject } from "@/types";
import { propertiesToSchema } from "@/validators/generic";
import { ApiVersion, BlockArg, BlockOptions } from "@/core";
import { InitialValues } from "@/runtime/reducePipeline";
import apiVersionOptions from "@/runtime/apiVersionOptions";
import { BusinessError } from "@/errors";
import { BlockPipeline } from "@/blocks/types";
import { mapArgs } from "@/runtime/mapArgs";

const logger = new ConsoleLogger();

class ContextBlock extends Block {
  constructor() {
    super("test/context", "Return Context");
  }

  inputSchema = propertiesToSchema({});

  async run(arg: BlockArg, { ctxt }: BlockOptions) {
    return ctxt;
  }
}

class EchoBlock extends Block {
  constructor() {
    super("test/echo", "Echo Block");
  }

  inputSchema = propertiesToSchema({
    message: {
      type: "string",
    },
  });

  async run({ message }: BlockArg) {
    return { message };
  }
}

/**
 * A block that returns a `prop` 🫖
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/418
 */
class TeapotBlock extends Block {
  constructor() {
    super("test/teapot", "Teapot Block");
  }

  inputSchema = propertiesToSchema({});

  async run() {
    return { prop: "I'm a teapot" };
  }
}

class IdentityBlock extends Block {
  constructor() {
    super("test/identity", "Identity Block");
  }

  inputSchema = propertiesToSchema({
    data: {},
  });

  async run(arg: BlockArg) {
    return arg;
  }
}

class ThrowBlock extends Block {
  constructor() {
    super("test/throw", "Throw Block");
  }

  inputSchema = propertiesToSchema({
    message: {
      type: "string",
    },
  });

  async run({ message }: BlockArg<{ message: string }>) {
    throw new BusinessError(message);
  }
}

class ArrayBlock extends Block {
  constructor() {
    super("test/array", "Array Block");
  }

  inputSchema = propertiesToSchema({});

  async run() {
    return [{ value: "foo" }, { value: "bar" }];
  }
}

class PipelineBlock extends Block {
  constructor() {
    super("test/pipeline", "Pipeline Block");
  }

  inputSchema = propertiesToSchema({
    // TODO: write a schema in schemas directory. The one in component.json is incomplete
    pipeline: {
      type: "array",
      items: {
        properties: {
          id: {
            type: "string",
          },
          config: {
            type: "object",
          },
        },
        required: ["id"],
      },
    },
  });

  async run({ pipeline }: BlockArg<{ pipeline: BlockPipeline }>) {
    return {
      length: pipeline.length,
    };
  }
}

/**
 * Test block that renders an array of elements with a deferred expression
 */
class DeferBlock extends Block {
  constructor() {
    super("test/defer", "Defer Block");
  }

  inputSchema = propertiesToSchema(
    {
      array: {
        type: "array",
      },
      elementKey: {
        type: "string",
        default: "element",
      },
      element: {
        type: "object",
        additionalProperties: true,
      },
    },
    ["array", "element"]
  );

  async run(
    {
      element,
      array = [],
      elementKey = "element",
    }: BlockArg<{
      element: UnknownObject;
      array: unknown[];
      elementKey?: string;
    }>,
    { ctxt }: BlockOptions
  ) {
    return Promise.all(
      array.map(async (data) => {
        const elementContext = {
          ...ctxt,
          [`@${elementKey}`]: data,
        };
        return mapArgs(element, elementContext, {
          implicitRender: null,
          ...apiVersionOptions("v3"),
        });
      })
    );
  }
}

export const echoBlock = new EchoBlock();
export const contextBlock = new ContextBlock();
export const identityBlock = new IdentityBlock();
export const throwBlock = new ThrowBlock();
export const teapotBlock = new TeapotBlock();
export const arrayBlock = new ArrayBlock();
export const pipelineBlock = new PipelineBlock();
export const deferBlock = new DeferBlock();

/**
 * Helper method to pass only `input` to reducePipeline.
 */
export function simpleInput(input: UnknownObject): InitialValues {
  return {
    input,
    root: null,
    serviceContext: {},
    optionsArgs: {},
  };
}

/**
 * Common reducePipeline options
 */
export function testOptions(version: ApiVersion) {
  return {
    logger,
    ...apiVersionOptions(version),
  };
}
