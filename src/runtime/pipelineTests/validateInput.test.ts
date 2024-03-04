/*
 * Copyright (C) 2024 PixieBrix, Inc.
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
import brickRegistry from "@/bricks/registry";
import { reducePipeline } from "@/runtime/reducePipeline";
import { InputValidationError } from "@/bricks/errors";
import { validateOutputKey } from "@/runtime/runtimeTypes";
import {
  contextBrick,
  echoBrick,
  simpleInput,
  testOptions,
} from "./pipelineTestHelpers";
import { extraEmptyModStateContext } from "@/runtime/extendModVariableContext";
import { BrickABC } from "@/types/brickTypes";
import { validateRegistryId } from "@/types/helpers";
import integrationRegistry from "@/integrations/registry";
import { fromJS } from "@/integrations/UserDefinedIntegration";
import { keyAuthIntegrationDefinitionFactory } from "@/testUtils/factories/integrationFactories";
import { metadataFactory } from "@/testUtils/factories/metadataFactory";
import { ContextError } from "@/errors/genericErrors";
import { propertiesToSchema } from "@/utils/schemaUtils";
import { autoUUIDSequence } from "@/testUtils/factories/stringFactories";

beforeEach(() => {
  integrationRegistry.clear();
  brickRegistry.clear();
  brickRegistry.register([echoBrick, contextBrick]);
});

describe("apiVersion: v1", () => {
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
        testOptions("v1"),
      );
    } catch (error) {
      expect(error).toBeInstanceOf(InputValidationError);
    }
  });

  test("throws error on missing input", async () => {
    const pipeline = [
      {
        id: echoBrick.id,
        config: { message: "{{inputArg}}" },
      },
    ];
    try {
      await reducePipeline(pipeline, simpleInput({}), testOptions("v1"));
    } catch (error) {
      expect(error).toBeInstanceOf(InputValidationError);
    }
  });
});

describe("apiVersion: v2", () => {
  test("throws error on wrong input type", async () => {
    const pipeline = [
      {
        id: echoBrick.id,
        // FIXME: this will resolve to a the empty string, is it throwing an error for the wrong reason?
        config: { message: "{{inputArg}}" },
      },
    ];
    try {
      await reducePipeline(
        pipeline,
        simpleInput({ inputArg: 42 }),
        testOptions("v2"),
      );
    } catch (error) {
      expect(error).toBeInstanceOf(InputValidationError);
    }
  });
});

describe.each([["v2"], ["v3"]])("apiVersion: %s", (apiVersion: ApiVersion) => {
  test("no implicit inputs", async () => {
    const pipeline = [
      {
        id: echoBrick.id,
        outputKey: validateOutputKey("first"),
        config: {
          message: "First block",
        },
      },
      {
        id: contextBrick.id,
        config: {},
      },
    ];
    const result = await reducePipeline(
      pipeline,
      simpleInput({ inputArg: "hello" }),
      testOptions(apiVersion),
    );

    expect(result).toStrictEqual({
      "@input": { inputArg: "hello" },
      "@options": {},
      ...extraEmptyModStateContext(apiVersion),
      "@first": { message: "First block" },
    });
  });

  test("validate integration configuration", async () => {
    class IntegrationBrick extends BrickABC {
      static BRICK_ID = validateRegistryId("test/integration");
      constructor() {
        super(IntegrationBrick.BRICK_ID, "Integration Brick");
      }

      inputSchema = propertiesToSchema(
        {
          config: {
            $ref: "https://app.pixiebrix.com/schemas/services/@scope/collection/name",
          },
        },
        ["config"],
      );

      async run() {}
    }

    const integrationDefinition = keyAuthIntegrationDefinitionFactory({
      metadata: metadataFactory({
        id: validateRegistryId("@scope/collection/name"),
      }),
      inputSchema: {
        $schema: "https://json-schema.org/draft/2019-09/schema#",
        type: "object",
        properties: {
          apiKey: {
            $ref: "https://app.pixiebrix.com/schemas/key#",
            title: "API Key",
          },
          baseURL: {
            type: "string",
          },
        },
        required: ["apiKey", "baseURL"],
      },
    });

    integrationRegistry.register([fromJS(integrationDefinition)]);
    brickRegistry.register([new IntegrationBrick()]);

    const pipeline = [
      {
        id: IntegrationBrick.BRICK_ID,
        config: {
          config: {},
        },
      },
    ];

    let actualError: unknown;

    try {
      await reducePipeline(pipeline, simpleInput({}), testOptions(apiVersion));
    } catch (error) {
      actualError = error;
    }

    expect(actualError).toBeInstanceOf(ContextError);
    const contextError = actualError as ContextError;
    expect(contextError.cause).toBeInstanceOf(InputValidationError);
    const inputValidationError = contextError.cause as InputValidationError;
    expect(inputValidationError.errors).toStrictEqual([
      {
        error: 'Property "config" does not match schema.',
        instanceLocation: "#",
        keyword: "properties",
        keywordLocation: "#/properties",
      },
      // We're not de-referencing the schema, so errors on the config are relative to the $ref:
      {
        error: "A subschema had errors.",
        instanceLocation: "#/config",
        keyword: "$ref",
        keywordLocation: "#/properties/config/$ref",
      },
      {
        // No error for apiKey because secrets are stripped out
        error: 'Instance does not have required property "baseURL".',
        instanceLocation: "#/config",
        keyword: "required",
        keywordLocation: "#/properties/config/$ref/required",
      },
    ]);
  });

  test("validate multiple database configuration", async () => {
    class DatabaseBrick extends BrickABC {
      static BRICK_ID = validateRegistryId("test/database");
      constructor() {
        super(DatabaseBrick.BRICK_ID, "Database Brick");
      }

      inputSchema = propertiesToSchema(
        {
          db1: {
            $ref: "https://app.pixiebrix.com/schemas/database#",
          },
          db2: {
            $ref: "https://app.pixiebrix.com/schemas/database#",
          },
        },
        ["db1", "db2"],
      );

      async run() {}
    }

    brickRegistry.register([new DatabaseBrick()]);

    const pipeline = [
      {
        id: DatabaseBrick.BRICK_ID,
        config: {
          db1: autoUUIDSequence(),
        },
      },
    ];

    let actualError: unknown;

    try {
      await reducePipeline(pipeline, simpleInput({}), testOptions(apiVersion));
    } catch (error) {
      actualError = error;
    }

    expect(actualError).toBeInstanceOf(ContextError);
    const contextError = actualError as ContextError;
    expect(contextError.cause).toBeInstanceOf(InputValidationError);
    const inputValidationError = contextError.cause as InputValidationError;
    expect(inputValidationError.errors).toStrictEqual([
      {
        error: 'Instance does not have required property "db2".',
        instanceLocation: "#",
        keyword: "required",
        keywordLocation: "#/required",
      },
    ]);
  });
});

describe("URLPattern smoke tests", () => {
  it("find integration schema", () => {
    const pattern = new URLPattern({ pathname: "/schemas/services/:id+" });
    const result = pattern.exec(
      "https://app.pixiebrix.com/schemas/services/@scope/collection/name",
    );
    expect(result.pathname.groups.id).toBe("@scope/collection/name");
  });
});
