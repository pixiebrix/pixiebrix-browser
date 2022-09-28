/*
 * Copyright (C) 2022 PixieBrix, Inc.
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

import { TableReader } from "@/blocks/transformers/component/TableReader";
import blockRegistry from "@/blocks/registry";
import { BlockConfig } from "@/blocks/types";
import { validateOutputKey } from "@/runtime/runtimeTypes";
import { reducePipeline } from "@/runtime/reducePipeline";
import { testOptions } from "@/runtime/pipelineTests/pipelineTestHelpers";
import { getTable } from "@/testUtils/tableHelpers";
import { screen } from "@testing-library/react";

jest.mock("@/background/messenger/api", () => {
  const actual = jest.requireActual("@/background/messenger/api");
  return {
    ...actual,
    getLoggingConfig: jest.fn().mockResolvedValue({
      logValues: true,
    }),
  };
});

const tableReaderBlock = new TableReader();

beforeEach(() => {
  blockRegistry.clear();
  blockRegistry.register(tableReaderBlock);
});

describe("TableReader", () => {
  test("throws an error when selector doesn't match a table/list", async () => {
    const blockConfig: BlockConfig = {
      id: tableReaderBlock.id,
      config: {
        orientation: "infer",
        selector: "#myTable",
      },
      outputKey: validateOutputKey("table"),
    };
    const root = document.createElement("div");
    root.innerHTML = `
      <table id="myTable">
        <tr><th>Name</th><th>Age</th></tr>
        <tr><td>Pete</td><td>25</td></tr>
        <tr><td>Steve</td><td>28</td></tr>
      </table>
    `;

    screen.debug(root);

    const result = await reducePipeline(
      blockConfig,
      {
        input: {},
        root,
        serviceContext: {},
        optionsArgs: {},
      },
      testOptions("v3")
    );

    expect(result).not.toBeNull();
  });
});
