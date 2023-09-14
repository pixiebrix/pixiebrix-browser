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

import { JQTransformer } from "@/bricks/transformers/jq";
import { unsafeAssumeValidArg } from "@/runtime/runtimeTypes";
import ConsoleLogger from "@/utils/ConsoleLogger";
import { InputValidationError } from "@/bricks/errors";
import { neverPromise } from "@/testUtils/testHelpers";
import { BusinessError } from "@/errors/businessErrors";
import { serializeError } from "serialize-error";
import { throwIfInvalidInput } from "@/runtime/runtimeUtils";
import { type RenderedArgs } from "@/types/runtimeTypes";
import { range } from "lodash";

describe("smoke tests", () => {
  test("passes input to filter", async () => {
    const promise = new JQTransformer().transform(
      unsafeAssumeValidArg({ filter: ".foo", data: { foo: 42 } }),
      {
        ctxt: {},
        root: null,
        logger: new ConsoleLogger(),
        runPipeline: neverPromise,
        runRendererPipeline: neverPromise,
      }
    );

    await expect(promise).resolves.toStrictEqual(42);
  });

  test("can run concurrently", async () => {
    // Smoke test we don't get `generic error, no stack` errors when running concurrently on node.
    // Pick a number that's quick-enough to run on CI
    const runCount = 20;

    const brick = new JQTransformer();
    const values = Promise.all(
      range(runCount).map(async (number) =>
        brick.transform(
          unsafeAssumeValidArg({
            filter: ".foo.data",
            data: { foo: { data: number } },
          }),
          {
            ctxt: {},
            root: null,
            logger: new ConsoleLogger(),
            runPipeline: neverPromise,
            runRendererPipeline: neverPromise,
          }
        )
      )
    );

    // There shouldn't be any interference between the concurrent runs
    await expect(values).resolves.toStrictEqual(range(runCount).map((n) => n));
  });
});

describe("ctxt", () => {
  test.each([[null], [""]])("pass context if data is %s", async (data) => {
    const promise = new JQTransformer().transform(
      unsafeAssumeValidArg({ filter: ".foo", data }),
      {
        ctxt: { foo: 42 },
        root: null,
        logger: new ConsoleLogger(),
        runPipeline: neverPromise,
        runRendererPipeline: neverPromise,
      }
    );

    await expect(promise).resolves.toStrictEqual(42);
  });
});

describe("json", () => {
  test("string data is not interpreted", async () => {
    const promise = new JQTransformer().transform(
      unsafeAssumeValidArg({ filter: ".", data: "[]" }),
      {
        ctxt: {},
        root: null,
        logger: new ConsoleLogger(),
        runPipeline: neverPromise,
        runRendererPipeline: neverPromise,
      }
    );

    // String is returned as-is, not as a JSON array
    await expect(promise).resolves.toStrictEqual("[]");
  });
});

describe("jq compilation errors", () => {
  test("error metadata matches", async () => {
    try {
      await throwIfInvalidInput(new JQTransformer(), {
        filter: 42,
        data: {},
      } as unknown as RenderedArgs);
      expect.fail("Invalid test, expected validateInput to throw");
    } catch (error) {
      expect(serializeError(error)).toStrictEqual({
        name: "InputValidationError",
        schema: expect.toBeObject(),
        input: expect.toBeObject(),
        message: expect.toBeString(),
        stack: expect.toBeString(),
        errors: [
          {
            error: expect.toBeString(),
            instanceLocation: "#",
            keyword: "properties",
            keywordLocation: "#/properties",
          },
          {
            error: expect.toBeString(),
            instanceLocation: "#/filter",
            keyword: "type",
            keywordLocation: "#/properties/filter/type",
          },
        ],
      });
    }
  });

  test("compile error has correct metadata", async () => {
    try {
      await new JQTransformer().transform(
        unsafeAssumeValidArg({ filter: '"', data: {} }),
        {
          ctxt: {},
          root: null,
          logger: new ConsoleLogger(),
          runPipeline: neverPromise,
          runRendererPipeline: neverPromise,
        }
      );
    } catch (error) {
      expect(serializeError(error)).toStrictEqual({
        name: "InputValidationError",
        schema: expect.toBeObject(),
        input: expect.toBeObject(),
        message: expect.toBeString(),
        stack: expect.toBeString(),
        errors: [
          {
            error: expect.toBeString(),
            instanceLocation: "#/filter",
            keyword: "format",
            keywordLocation: "#/properties/filter/format",
          },
        ],
      });
    }
  });

  test("missing brace", async () => {
    // https://github.com/pixiebrix/pixiebrix-extension/issues/3216
    const promise = new JQTransformer().transform(
      unsafeAssumeValidArg({ filter: "{", data: {} }),
      {
        ctxt: {},
        root: null,
        logger: new ConsoleLogger(),
        runPipeline: neverPromise,
        runRendererPipeline: neverPromise,
      }
    );

    await expect(promise).rejects.toThrow(InputValidationError);
    await expect(promise).rejects.toThrow(
      "Unexpected end of jq filter, are you missing a parentheses, brace, and/or quote mark?"
    );
  });

  test("multiple compile errors", async () => {
    // https://github.com/pixiebrix/pixiebrix-extension/issues/3216
    const promise = new JQTransformer().transform(
      unsafeAssumeValidArg({ filter: "a | b", data: {} }),
      {
        ctxt: {},
        root: null,
        logger: new ConsoleLogger(),
        runPipeline: neverPromise,
        runRendererPipeline: neverPromise,
      }
    );

    await expect(promise).rejects.toThrow(InputValidationError);
    await expect(promise).rejects.toThrow(
      "Invalid jq filter, see error log for details"
    );
  });
});

describe("jq execution errors", () => {
  test("null iteration", async () => {
    // https://github.com/pixiebrix/pixiebrix-extension/issues/3216
    const promise = new JQTransformer().transform(
      unsafeAssumeValidArg({ filter: ".foo[]", data: {} }),
      {
        ctxt: {},
        root: null,
        logger: new ConsoleLogger(),
        runPipeline: neverPromise,
        runRendererPipeline: neverPromise,
      }
    );

    await expect(promise).rejects.toThrow(BusinessError);
    await expect(promise).rejects.toThrow("Cannot iterate over null (null)");
  });

  test("invalid fromdate", async () => {
    // https://github.com/pixiebrix/pixiebrix-extension/issues/3216
    const promise = new JQTransformer().transform(
      unsafeAssumeValidArg({ filter: '"" | fromdate', data: {} }),
      {
        ctxt: {},
        root: null,
        logger: new ConsoleLogger(),
        runPipeline: neverPromise,
        runRendererPipeline: neverPromise,
      }
    );

    await expect(promise).rejects.toThrow(BusinessError);
    await expect(promise).rejects.toThrow(
      'date "" does not match format "%Y-%m-%dT%H:%M:%SZ"'
    );
  });
});

describe("known jq-web bugs and quirks", () => {
  test("Error if no result set produced", async () => {
    // https://github.com/fiatjaf/jq-web/issues/32
    const promise = new JQTransformer().transform(
      unsafeAssumeValidArg({ filter: ".[] | .Title", data: [] }),
      {
        ctxt: {},
        root: null,
        logger: new ConsoleLogger(),
        runPipeline: neverPromise,
        runRendererPipeline: neverPromise,
      }
    );

    await expect(promise).rejects.toThrow(BusinessError);
    await expect(promise).rejects.toThrow(
      "ensure the jq filter produces a result for the data"
    );
  });

  test.skip("running 2048+ times causes FS errors", async () => {
    // https://github.com/fiatjaf/jq-web/issues/18
    // Skipping on CI because it's too slow to run this test

    const brick = new JQTransformer();
    const values = Promise.all(
      range(3000).map(async (number) =>
        brick.transform(
          unsafeAssumeValidArg({
            filter: ".foo.data",
            data: { foo: { data: number } },
          }),
          {
            ctxt: {},
            root: null,
            logger: new ConsoleLogger(),
            runPipeline: neverPromise,
            runRendererPipeline: neverPromise,
          }
        )
      )
    );

    await expect(values).rejects.toThrow(
      "Error opening stream, reload the page"
    );

    // Uncomment this when the bug in the dependency has been fixed
    // await expect(values).resolves.toStrictEqual(range(3000).map((n) => n));
  });

  test("error using modulo operator in filter", async () => {
    // https://github.com/fiatjaf/jq-web/issues/19
    const promise = new JQTransformer().transform(
      unsafeAssumeValidArg({ filter: "1 % 1", data: [] }),
      {
        ctxt: {},
        root: null,
        logger: new ConsoleLogger(),
        runPipeline: neverPromise,
        runRendererPipeline: neverPromise,
      }
    );

    await expect(promise).rejects.toThrow(BusinessError);
    await expect(promise).rejects.toThrow("wA is not a function");
  });
});
