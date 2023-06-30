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

import { type ApiVersion } from "@/types/runtimeTypes";
import blockRegistry from "@/blocks/registry";
import { reducePipeline } from "@/runtime/reducePipeline";
import { InputValidationError } from "@/blocks/errors";
import { type BrickPipeline } from "@/blocks/types";
import {
  contextBrick,
  echoBrick,
  simpleInput,
  testOptions,
} from "@/runtime/pipelineTests/pipelineTestHelpers";

beforeEach(() => {
  blockRegistry.clear();
  blockRegistry.register([echoBrick, contextBrick]);
});

describe("apiVersion: v1", () => {
  test("true mustache conditional via implicit args", async () => {
    const pipeline = [
      {
        id: echoBrick.id,
        if: "{{# run }}true{{/ run }}",
        config: {
          message: "Ran block",
        },
      },
    ];
    const result = await reducePipeline(
      pipeline,
      { ...simpleInput({ run: true }), optionsArgs: {} },
      testOptions("v1")
    );
    expect(result).toStrictEqual({ message: "Ran block" });
  });
});

describe.each([["v1"], ["v2"]])("apiVersion: %s", (apiVersion: ApiVersion) => {
  test("true mustache conditional", async () => {
    const pipeline = [
      {
        id: echoBrick.id,
        if: "{{# @input.run }}true{{/ @input.run }}",
        config: {
          message: "Ran block",
        },
      },
    ];
    const result = await reducePipeline(
      pipeline,
      { ...simpleInput({ run: true }), optionsArgs: {} },
      testOptions(apiVersion)
    );
    expect(result).toStrictEqual({ message: "Ran block" });
  });
});

describe("false mustache conditional", () => {
  test("v1", async () => {
    const pipeline = [
      {
        id: echoBrick.id,
        if: "{{# @input.run }}true{{/ @input.run }}",
        config: {
          message: "Ran block",
        },
      },
    ];
    const result = await reducePipeline(
      pipeline,
      { ...simpleInput({ run: false }), optionsArgs: {} },
      testOptions("v1")
    );
    // The original input is passed through
    expect(result).toStrictEqual({ run: false });
  });

  test("v2", async () => {
    const pipeline = [
      {
        id: echoBrick.id,
        if: "{{# @input.run }}true{{/ @input.run }}",
        config: {
          message: "Ran block",
        },
      },
    ];
    const result = await reducePipeline(
      pipeline,
      { ...simpleInput({ run: false }), optionsArgs: {} },
      testOptions("v2")
    );
    // The starting value is {}
    expect(result).toStrictEqual({});
  });

  test("v3 - implicit mustache interpreted as string", async () => {
    const pipeline = [
      {
        id: echoBrick.id,
        if: "{{# @input.run }}true{{/ @input.run }}",
        config: {
          message: "Ran block",
        },
      },
    ];
    const result = await reducePipeline(
      pipeline,
      { ...simpleInput({ run: false }), optionsArgs: {} },
      testOptions("v3")
    );
    // The block still doesn't run because the string is not truthy according to boolean
    expect(result).toStrictEqual({});
  });

  test("v3 - mustache provided", async () => {
    const pipeline = [
      {
        id: echoBrick.id,
        if: {
          __type__: "mustache",
          __value__: "{{# @input.run }}true{{/ @input.run }}",
        },
        config: {
          message: "Ran block",
        },
      },
    ];
    const result = await reducePipeline(
      pipeline as BrickPipeline,
      { ...simpleInput({ run: false }), optionsArgs: {} },
      testOptions("v3")
    );
    expect(result).toStrictEqual({});
  });
});

describe("apiVersion: v2", () => {
  test("throws error on wrong input type", async () => {
    const pipeline = [
      {
        id: echoBrick.id,
        config: { message: "{{inputArg}}" },
      },
    ];
    try {
      await reducePipeline(
        pipeline,
        simpleInput({ inputArg: 42 }),
        testOptions("v2")
      );
    } catch (error) {
      expect(error).toBeInstanceOf(InputValidationError);
    }
  });
});
