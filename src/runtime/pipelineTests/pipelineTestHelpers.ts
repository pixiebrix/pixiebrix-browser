import ConsoleLogger from "@/utils/ConsoleLogger";
import { propertiesToSchema } from "@/validators/generic";
import { type InitialValues } from "@/runtime/reducePipeline";
import apiVersionOptions from "@/runtime/apiVersionOptions";
import {
  isDeferExpression,
  mapArgs,
  type PipelineExpression,
} from "@/runtime/mapArgs";
import { BusinessError } from "@/errors/businessErrors";
import { UNSET_UUID, validateRegistryId } from "@/types/helpers";
import {
  type ApiVersion,
  type BrickArgs,
  type BlockOptions,
  type OptionsArgs,
} from "@/types/runtimeTypes";
import { BrickABC } from "@/types/blockTypes";
import { type UnknownObject } from "@/types/objectTypes";
import { type Schema } from "@/types/schemaTypes";

const logger = new ConsoleLogger();

export class ContextBlock extends BrickABC {
  static contexts: UnknownObject[] = [];

  constructor() {
    super("test/context", "Return Context");
  }

  static clearContexts() {
    ContextBlock.contexts = [];
  }

  inputSchema = propertiesToSchema({});

  async run(arg: BrickArgs, { ctxt }: BlockOptions) {
    ContextBlock.contexts.push(ctxt);
    return ctxt;
  }
}

export class EchoBlock extends BrickABC {
  static BLOCK_ID = validateRegistryId("test/echo");
  constructor() {
    super(EchoBlock.BLOCK_ID, "Echo BrickABC");
  }

  inputSchema = propertiesToSchema({
    message: {
      type: "string",
    },
  });

  async run({ message }: BrickArgs) {
    return { message };
  }
}

class RootAwareBlock extends BrickABC {
  constructor() {
    super("test/root-aware", "Root Aware");
  }

  inputSchema = propertiesToSchema({});

  async run(_arg: BrickArgs, { root }: BlockOptions) {
    return {
      tagName: (root as HTMLElement).tagName,
    };
  }
}

/**
 * A block that returns a `prop` 🫖
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/418
 */
class TeapotBlock extends BrickABC {
  constructor() {
    super("test/teapot", "Teapot BrickABC");
  }

  inputSchema = propertiesToSchema({});

  async run() {
    return { prop: "I'm a teapot" };
  }
}

class IdentityBlock extends BrickABC {
  constructor() {
    super("test/identity", "Identity BrickABC");
  }

  inputSchema = propertiesToSchema({
    data: {},
  });

  async run(arg: BrickArgs) {
    return arg;
  }
}

class ThrowBlock extends BrickABC {
  constructor() {
    super("test/throw", "Throw BrickABC");
  }

  inputSchema = propertiesToSchema({
    message: {
      type: "string",
    },
  });

  async run({ message }: BrickArgs<{ message: string }>) {
    throw new BusinessError(message);
  }
}

class ArrayBlock extends BrickABC {
  constructor() {
    super("test/array", "Array BrickABC");
  }

  inputSchema = propertiesToSchema({});

  async run() {
    return [{ value: "foo" }, { value: "bar" }];
  }
}

// TODO: write a schema in schemas directory. The one in component.json is incomplete
const pipelineSchema: Schema = {
  type: "object",
  properties: {
    __type__: {
      type: "string",
      const: "pipeline",
    },
    __value__: {
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
  },
};

/**
 * A block for testing pipeline functionality. Returns the length of the provided pipeline block input.
 */
class PipelineBlock extends BrickABC {
  constructor() {
    super("test/pipeline", "Pipeline BrickABC");
  }

  inputSchema = propertiesToSchema({
    pipeline: pipelineSchema,
  });

  async run({ pipeline }: BrickArgs<{ pipeline: PipelineExpression }>) {
    return {
      length: pipeline.__value__.length,
    };
  }
}

/**
 * Test block that renders an array of elements with a deferred expression
 */
class DeferBlock extends BrickABC {
  constructor() {
    super("test/defer", "Defer BrickABC");
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
    }: BrickArgs<{
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

        if (isDeferExpression(element)) {
          return mapArgs(element.__value__, elementContext, {
            implicitRender: null,
            ...apiVersionOptions("v3"),
          });
        }

        return element;
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
export const rootAwareBlock = new RootAwareBlock();

/**
 * Helper method to pass only `input` to reducePipeline.
 */
export function simpleInput(input: UnknownObject): InitialValues {
  return {
    input,
    root: null,
    serviceContext: {},
    optionsArgs: {} as OptionsArgs,
  };
}

/**
 * Common reducePipeline options
 */
export function testOptions(version: ApiVersion) {
  return {
    logger,
    extensionId: UNSET_UUID,
    ...apiVersionOptions(version),
  };
}
