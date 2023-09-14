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

import { WithAsyncModVariable } from "@/bricks/transformers/controlFlow/WithAsyncModVariable";
import { makePipelineExpression } from "@/runtime/expressionCreators";
import {
  DeferredEchoBrick,
  simpleInput,
  testOptions,
  throwBrick,
} from "@/runtime/pipelineTests/pipelineTestHelpers";
import { reducePipeline } from "@/runtime/reducePipeline";
import brickRegistry from "@/bricks/registry";
import ConsoleLogger from "@/utils/ConsoleLogger";
import { getPageState, setPageState } from "@/contentScript/pageState";
import pDefer, { type DeferredPromise } from "p-defer";
import { tick } from "@/starterBricks/starterBrickTestUtils";
import { type Brick } from "@/types/brickTypes";
import {
  autoUUIDSequence,
  registryIdFactory,
} from "@/testUtils/factories/stringFactories";
import { type UUID } from "@/types/stringTypes";
import { type UnknownObject } from "@/types/objectTypes";

const withAsyncModVariableBrick = new WithAsyncModVariable();

const makeAsyncModVariablePipeline = (
  brick: Brick,
  message: string,
  stateKey: string
) => ({
  id: withAsyncModVariableBrick.id,
  config: {
    body: makePipelineExpression([
      {
        id: brick.id,
        config: {
          message,
        },
      },
    ]),
    stateKey,
  },
});

const extensionId = autoUUIDSequence();
const blueprintId = registryIdFactory();

const logger = new ConsoleLogger({
  extensionId,
  blueprintId,
});

function expectPageState(expectedState: UnknownObject) {
  const pageState = getPageState({
    namespace: "blueprint",
    extensionId,
    blueprintId,
  });

  expect(pageState).toStrictEqual(expectedState);
}

describe("WithAsyncModVariable", () => {
  let deferred: DeferredPromise<void>;
  let asyncEchoBrick: DeferredEchoBrick;

  beforeEach(() => {
    // Reset the page state to avoid interference between tests
    setPageState({
      namespace: "blueprint",
      data: {},
      blueprintId,
      extensionId,
      mergeStrategy: "replace",
    });

    // Most tests just require a single brick instance for testing
    deferred = pDefer();
    asyncEchoBrick = new DeferredEchoBrick(deferred.promise);

    brickRegistry.clear();
    brickRegistry.register([
      asyncEchoBrick,
      throwBrick,
      withAsyncModVariableBrick,
    ]);
  });

  test("returns request nonce and initializes page state immediately", async () => {
    const pipeline = makeAsyncModVariablePipeline(asyncEchoBrick, "bar", "foo");

    const brickOutput = await reducePipeline(pipeline, simpleInput({}), {
      ...testOptions("v3"),
      logger,
    });

    expect(brickOutput).toStrictEqual({
      requestId: expect.toBeString(),
    });

    expectPageState({
      foo: {
        // Initializes loading state
        isLoading: true,
        isFetching: true,
        isSuccess: false,
        isError: false,
        currentData: null,
        data: null,
        requestId: null,
        error: null,
      },
    });
  });

  test("returns request nonce and sets page state on success", async () => {
    const pipeline = makeAsyncModVariablePipeline(asyncEchoBrick, "bar", "foo");

    const brickOutput = await reducePipeline(pipeline, simpleInput({}), {
      ...testOptions("v3"),
      logger,
    });

    deferred.resolve();
    await tick();

    expect(brickOutput).toStrictEqual({
      requestId: expect.toBeString(),
    });

    expectPageState({
      foo: {
        isLoading: false,
        isFetching: false,
        isSuccess: true,
        isError: false,
        currentData: { message: "bar" },
        data: { message: "bar" },
        // Shape asserted above
        requestId: (brickOutput as { requestId: UUID }).requestId,
        error: null,
      },
    });
  });

  test("returns request nonce and sets page state on error", async () => {
    const pipeline = makeAsyncModVariablePipeline(throwBrick, "error", "foo");

    const brickOutput = await reducePipeline(pipeline, simpleInput({}), {
      ...testOptions("v3"),
      logger,
    });

    await tick();

    expect(brickOutput).toStrictEqual({
      requestId: expect.toBeString(),
    });

    expectPageState({
      foo: expect.objectContaining({
        isLoading: false,
        isFetching: false,
        isSuccess: false,
        isError: true,
        currentData: null,
        data: null,
        // Shape asserted above
        requestId: (brickOutput as { requestId: UUID }).requestId,
        error: expect.objectContaining({
          cause: expect.objectContaining({
            name: "BusinessError",
            message: "error",
          }),
        }),
      }),
    });
  });

  test("only sets page state with latest request result; ignores stale requests", async () => {
    const modVariable = "foo";
    const expectedMessage = "bar";
    const firstDeferred = pDefer();
    const secondDeferred = pDefer();

    const promiseFactory = jest
      .fn()
      .mockReturnValueOnce(firstDeferred.promise)
      .mockReturnValueOnce(secondDeferred.promise);

    // Override the default brick for the test
    const staleAsyncBrick = new DeferredEchoBrick(promiseFactory);
    brickRegistry.register([staleAsyncBrick]);

    const pipeline = makeAsyncModVariablePipeline(
      asyncEchoBrick,
      expectedMessage,
      modVariable
    );
    const stalePipeline = makeAsyncModVariablePipeline(
      staleAsyncBrick,
      "I shouldn't be in the page state!",
      modVariable
    );

    await reducePipeline(stalePipeline, simpleInput({}), {
      ...testOptions("v3"),
      logger,
    });

    const secondOutput = await reducePipeline(pipeline, simpleInput({}), {
      ...testOptions("v3"),
      logger,
    });

    // Neither are resolved, should be in loading state
    expectPageState({
      foo: {
        isLoading: true,
        isFetching: true,
        isSuccess: false,
        isError: false,
        currentData: null,
        data: null,
        requestId: null,
        error: null,
      },
    });

    secondDeferred.resolve();
    await tick();

    // State should update to be the second request, even though the first request is not completed
    expectPageState({
      foo: {
        isLoading: false,
        isFetching: false,
        isSuccess: true,
        isError: false,
        currentData: { message: expectedMessage },
        data: { message: expectedMessage },
        // Shape asserted above
        requestId: (secondOutput as { requestId: UUID }).requestId,
        error: null,
      },
    });

    firstDeferred.resolve();
    await tick();

    // State should not update, because the result from the first call is stale
    expectPageState({
      foo: {
        isLoading: false,
        isFetching: false,
        isSuccess: true,
        isError: false,
        currentData: { message: expectedMessage },
        data: { message: expectedMessage },
        // Shape asserted above
        requestId: (secondOutput as { requestId: UUID }).requestId,
        error: null,
      },
    });
  });
});
