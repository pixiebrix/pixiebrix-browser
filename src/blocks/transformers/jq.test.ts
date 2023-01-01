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

import { JQTransformer } from "@/blocks/transformers/jq";
import { unsafeAssumeValidArg } from "@/runtime/runtimeTypes";
import ConsoleLogger from "@/utils/ConsoleLogger";
import { InputValidationError } from "@/blocks/errors";
import { neverPromise } from "@/testUtils/testHelpers";
import { BusinessError } from "@/errors/businessErrors";

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

describe("parse compile error", () => {
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

    await expect(promise).rejects.toThrow(InputValidationError);
    await expect(promise).rejects.toThrow(
      'date "" does not match format "%Y-%m-%dT%H:%M:%SZ"'
    );
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
});
