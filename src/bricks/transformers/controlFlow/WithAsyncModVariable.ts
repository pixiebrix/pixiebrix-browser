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

import { TransformerABC } from "@/types/bricks/transformerTypes";
import { uuidv4, validateRegistryId } from "@/types/helpers";
import { type Schema } from "@/types/schemaTypes";
import { propertiesToSchema } from "@/validators/generic";
import { getPageState, setPageState } from "@/contentScript/pageState";
import {
  type BrickArgs,
  type BrickOptions,
  type PipelineExpression,
} from "@/types/runtimeTypes";
import { serializeError } from "serialize-error";
import { type JsonObject } from "type-fest";
import { type UUID } from "@/types/stringTypes";
import { isNullOrBlank } from "@/utils/stringUtils";
import { isEmpty } from "lodash";
import { PropError } from "@/errors/businessErrors";

/**
 * Map to keep track of the current execution nonce for each Mod Variable. Used to ignore stale request results.
 */
const modVariableNonces = new Map<string, UUID>();

/**
 * A brick that stores the result of an asynchronous operation in a Mod Variable.
 *
 * The state shape is defined to be similar to RTK Query and our async hooks:
 * https://redux-toolkit.js.org/rtk-query/api/created-api/hooks#usequery
 */
export class WithAsyncModVariable extends TransformerABC {
  // Brick id matches the existing YAML-defined brick id. The JS brick automatically takes precedence over the
  // user-defined brick if it's available.
  static readonly BRICK_ID = validateRegistryId("@pixies/async");

  constructor() {
    super(
      WithAsyncModVariable.BRICK_ID,
      "Run with Async Mod Variable",
      "Run bricks asynchronously and store the status and result in a Mod Variable"
    );
  }

  override async isPure(): Promise<boolean> {
    // Modifies the Page State
    return false;
  }

  override async isPageStateAware(): Promise<boolean> {
    return true;
  }

  inputSchema: Schema = propertiesToSchema(
    {
      body: {
        $ref: "https://app.pixiebrix.com/schemas/pipeline#",
        title: "Body",
        description: "The bricks to run asynchronously",
      },
      stateKey: {
        title: "Mod Variable Name",
        type: "string",
        description: "The Mod Variable to store the status and data in",
      },
    },
    ["body", "stateKey"]
  );

  defaultOutputKey = "async";

  override outputSchema: Schema = {
    type: "object",
    properties: {
      requestId: {
        type: "string",
        format: "uuid",
        description:
          "A unique nonce for the run. Can be used to correlate the run with the Mod Variable data.",
      },
    },
    required: ["requestId"],
    additionalProperties: false,
  };

  async transform(
    {
      body,
      stateKey,
    }: BrickArgs<{
      body: PipelineExpression;
      stateKey: string;
    }>,
    { logger, runPipeline }: BrickOptions
  ) {
    const requestId = uuidv4();
    const { blueprintId, extensionId } = logger.context;

    if (isNullOrBlank(stateKey)) {
      throw new PropError(
        "Mod Variable Name is required",
        this.id,
        "stateKey",
        stateKey
      );
    }

    const isCurrentNonce = () => modVariableNonces.get(stateKey) === requestId;

    const setModVariable = (data: JsonObject, strategy: "put" | "patch") => {
      setPageState({
        // Store as Mod Variable
        namespace: "blueprint",
        data: {
          [stateKey]: data,
        },
        // Using shallow will replace the state key, but keep other keys
        mergeStrategy: strategy === "put" ? "shallow" : "deep",
        extensionId,
        blueprintId,
      });
    };

    // Mark as current request
    modVariableNonces.set(stateKey, requestId);

    // Get/set page state calls are synchronous from the content script, so safe to call sequentially
    const currentState = getPageState({
      namespace: "blueprint",
      extensionId,
      blueprintId,
    });

    // eslint-disable-next-line security/detect-object-injection -- user provided value that's readonly
    const currentVariable = currentState[stateKey] ?? {};

    if (isEmpty(currentVariable)) {
      // Initialize the mod variable
      setModVariable(
        {
          isLoading: true,
          isFetching: true,
          isSuccess: false,
          isError: false,
          currentData: null,
          data: null,
          // Nonce is set when setting the data/error
          requestId: null,
          error: null,
        },
        "patch"
      );
    } else {
      // Preserve the previous data/error, if any
      setModVariable(
        {
          isFetching: true,
          currentData: null,
        },
        "patch"
      );
    }

    const bodyPromise = runPipeline(body, {
      key: "body",
      counter: 0,
    });

    void bodyPromise
      // eslint-disable-next-line promise/prefer-await-to-then -- not blocking
      .then((data: JsonObject) => {
        if (!isCurrentNonce()) {
          return;
        }

        setModVariable(
          {
            isLoading: false,
            isFetching: false,
            isSuccess: true,
            isError: false,
            currentData: data,
            data,
            requestId,
            error: null,
          },
          "put"
        );
      })
      // eslint-disable-next-line promise/prefer-await-to-then -- not blocking
      .catch((error) => {
        if (!isCurrentNonce()) {
          return;
        }

        setModVariable(
          {
            isLoading: false,
            isFetching: false,
            isSuccess: false,
            isError: true,
            currentData: null,
            data: null,
            requestId,
            error: serializeError(error),
          },
          "put"
        );
      });

    return {
      requestId,
    };
  }
}
