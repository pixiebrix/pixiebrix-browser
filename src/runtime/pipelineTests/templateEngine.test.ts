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

import blockRegistry from "@/blocks/registry";
import { reducePipeline } from "@/runtime/reducePipeline";
import { BlockConfig } from "@/blocks/types";
import {
  contextBlock,
  echoBlock,
  simpleInput,
  testOptions,
} from "./pipelineTestHelpers";

// Mock the recordX trace methods. Otherwise they'll fail and Jest will have unhandledrejection errors since we call
// them with `void` instead of awaiting them in the reducePipeline methods
import * as logging from "@/background/logging";
jest.mock("@/background/trace");
(logging.getLoggingConfig as any) = jest.fn().mockResolvedValue({
  logValues: true,
});

beforeEach(() => {
  blockRegistry.clear();
  blockRegistry.register(echoBlock, contextBlock);
});

describe.each([["mustache"], ["handlebars"], ["nunjucks"]])(
  "apiVersion: v1, templateEngine: %s",
  (templateEngine) => {
    test("render template with templateEngine", async () => {
      const pipeline = {
        id: echoBlock.id,
        // All of the engines accept the same {{ template for standard strings
        config: { message: "{{inputArg}}" },
        templateEngine,
      };
      const result = await reducePipeline(
        pipeline as BlockConfig,
        simpleInput({ inputArg: "hello" }),
        testOptions("v1")
      );
      expect(result).toStrictEqual({ message: "hello" });
    });
  }
);

describe("apiVersion: v1", () => {
  test("default to mustache", async () => {
    const pipeline = {
      id: echoBlock.id,
      config: { message: "{{inputArg}}" },
    };
    const result = await reducePipeline(
      pipeline,
      simpleInput({ inputArg: "hello" }),
      testOptions("v1")
    );
    expect(result).toStrictEqual({ message: "hello" });
  });

  test("use nunjucks filter", async () => {
    const pipeline = {
      id: echoBlock.id,
      config: { message: "{{inputArg | upper}}" },
      templateEngine: "nunjucks",
    };
    const result = await reducePipeline(
      pipeline as BlockConfig,
      simpleInput({ inputArg: "hello" }),
      testOptions("v1")
    );
    expect(result).toStrictEqual({ message: "HELLO" });
  });
});

describe("apiVersion: v3", () => {
  test("ignore implicit mustache template", async () => {
    const pipeline = {
      id: echoBlock.id,
      config: { message: "{{@input.inputArg}}" },
    };
    const result = await reducePipeline(
      pipeline,
      simpleInput({ inputArg: "hello" }),
      testOptions("v3")
    );
    expect(result).toStrictEqual({ message: "{{@input.inputArg}}" });
  });

  test("apply explicit mustache template", async () => {
    const pipeline = {
      id: echoBlock.id,
      config: {
        message: {
          __type__: "mustache",
          __value__: "{{@input.inputArg}}",
        },
      },
    };
    const result = await reducePipeline(
      pipeline,
      simpleInput({ inputArg: "hello" }),
      testOptions("v3")
    );
    expect(result).toStrictEqual({ message: "hello" });
  });

  test("ignore templateEngine", async () => {
    const pipeline = {
      id: echoBlock.id,
      config: {
        message: {
          __type__: "nunjucks",
          __value__: "{{@input.inputArg | upper}}",
        },
      },
      templateEngine: "mustache",
    };
    const result = await reducePipeline(
      pipeline as BlockConfig,
      simpleInput({ inputArg: "hello" }),
      testOptions("v3")
    );
    expect(result).toStrictEqual({ message: "HELLO" });
  });

  test("apply var", async () => {
    const pipeline = {
      id: echoBlock.id,
      config: {
        message: {
          __type__: "var",
          __value__: "@input.inputArg",
        },
      },
    };
    const result = await reducePipeline(
      pipeline,
      simpleInput({ inputArg: "hello" }),
      testOptions("v3")
    );
    expect(result).toStrictEqual({ message: "hello" });
  });
});
