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

import { formStateFactory } from "@/testUtils/factories/pageEditorFactories";
import ModVariableSchemasVisitor from "@/analysis/analysisVisitors/pageStateAnalysis/modVariableSchemasVisitor";
import AssignModVariable from "@/bricks/effects/assignModVariable";
import { makeTemplateExpression } from "@/runtime/expressionCreators";
import registerBuiltinBlocks from "@/bricks/registerBuiltinBlocks";

beforeAll(() => {
  registerBuiltinBlocks();
});

describe("ModVariableSchemasVisitor", () => {
  it("collects event schema from a template literal", async () => {
    const formState = formStateFactory();
    formState.extension.blockPipeline[0] = {
      id: AssignModVariable.BRICK_ID,
      config: {
        variableName: makeTemplateExpression("nunjucks", "foo"),
      },
    };

    const result = ModVariableSchemasVisitor.collectSchemas([formState]);

    await expect(result).resolves.toEqual({
      knownSchemas: [{ foo: true }],
    });
  });

  it("unions known schemas", async () => {
    const formState = formStateFactory();
    formState.extension.blockPipeline[0] = {
      id: AssignModVariable.BRICK_ID,
      config: {
        variableName: "foo",
      },
    };

    const otherFormState = formStateFactory();
    otherFormState.extension.blockPipeline[0] = {
      id: AssignModVariable.BRICK_ID,
      config: {
        variableName: "bar",
      },
    };

    const result = ModVariableSchemasVisitor.collectSchemas([
      formState,
      otherFormState,
    ]);

    await expect(result).resolves.toEqual({
      knownSchemas: [{ foo: true }, { bar: true }],
    });
  });

  it("does not duplicate schemas", async () => {
    const formState = formStateFactory();
    formState.extension.blockPipeline[0] = {
      id: AssignModVariable.BRICK_ID,
      config: {
        variableName: "foo",
      },
    };

    const otherFormState = formStateFactory();
    otherFormState.extension.blockPipeline[0] = {
      id: AssignModVariable.BRICK_ID,
      config: {
        variableName: "foo",
      },
    };

    const result = ModVariableSchemasVisitor.collectSchemas([
      formState,
      otherFormState,
    ]);

    await expect(result).resolves.toEqual({
      knownSchemas: [{ foo: true }],
    });
  });
});
