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

import blockRegistry from "@/blocks/registry";
import {
  rootAwareBrick,
  simpleInput,
  teapotBrick,
  testOptions,
  throwBrick,
} from "@/runtime/pipelineTests/pipelineTestHelpers";
import IfElse from "@/blocks/transformers/controlFlow/IfElse";
import { reducePipeline } from "@/runtime/reducePipeline";
import { makePipelineExpression } from "@/runtime/expressionCreators";
import { validateOutputKey } from "@/runtime/runtimeTypes";

const ifElseBlock = new IfElse();

beforeEach(() => {
  blockRegistry.clear();
  blockRegistry.register([
    teapotBrick,
    throwBrick,
    rootAwareBrick,
    ifElseBlock,
  ]);
});

describe("IfElse", () => {
  test("if branch", async () => {
    const pipeline = {
      id: ifElseBlock.id,
      config: {
        condition: true,
        if: makePipelineExpression([{ id: teapotBrick.id, config: {} }]),
        else: makePipelineExpression([{ id: throwBrick.id, config: {} }]),
      },
    };
    const result = await reducePipeline(
      pipeline,
      simpleInput({}),
      testOptions("v3")
    );
    expect(result).toStrictEqual({ prop: "I'm a teapot" });
  });

  test("if branch with output key", async () => {
    const pipeline = {
      id: ifElseBlock.id,
      config: {
        condition: true,
        if: makePipelineExpression([
          {
            id: teapotBrick.id,
            config: {},
            outputKey: validateOutputKey("branchResult"),
          },
        ]),
        else: makePipelineExpression([
          {
            id: throwBrick.id,
            config: {},
            outputKey: validateOutputKey("branchResult"),
          },
        ]),
      },
    };
    const result = await reducePipeline(
      pipeline,
      simpleInput({}),
      testOptions("v3")
    );
    expect(result).toStrictEqual({ prop: "I'm a teapot" });
  });

  test("else branch", async () => {
    const pipeline = {
      id: ifElseBlock.id,
      config: {
        condition: false,
        // Throw to make it more obvious if this branch was taken
        if: makePipelineExpression([{ id: throwBrick.id, config: {} }]),
        else: makePipelineExpression([{ id: teapotBrick.id, config: {} }]),
      },
    };
    const result = await reducePipeline(
      pipeline,
      simpleInput({}),
      testOptions("v3")
    );
    expect(result).toStrictEqual({ prop: "I'm a teapot" });
  });

  test("else optional", async () => {
    const pipeline = {
      id: ifElseBlock.id,
      config: {
        condition: false,
        // Throw to make it more obvious if this branch was taken
        if: makePipelineExpression([{ id: throwBrick.id, config: {} }]),
      },
    };
    const result = await reducePipeline(
      pipeline,
      simpleInput({}),
      testOptions("v3")
    );
    expect(result).toStrictEqual(null);
  });

  test("root aware", async () => {
    const pipeline = {
      id: ifElseBlock.id,
      config: {
        condition: true,
        if: makePipelineExpression([{ id: rootAwareBrick.id, config: {} }]),
      },
    };
    const result = await reducePipeline(
      pipeline,
      {
        root: document.createElement("div"),
        input: {},
        optionsArgs: {},
        serviceContext: {},
      },
      testOptions("v3")
    );
    expect(result).toStrictEqual({
      tagName: "DIV",
    });
  });
});
