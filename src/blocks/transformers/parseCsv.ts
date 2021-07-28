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

import { Transformer } from "@/types";
import { BlockArg, Schema } from "@/core";
import { propertiesToSchema } from "@/validators/generic";
import { registerBlock } from "@/blocks/registry";

export class ParseCsv extends Transformer {
  constructor() {
    super(
      "@pixiebrix/parse/csv",
      "Parse CSV",
      "Parse a string as a CSV file",
      "faCode"
    );
  }

  inputSchema: Schema = propertiesToSchema({
    content: {
      type: "string",
      description: "The contents of the CSV file",
    },
  });

  outputSchema: Schema = propertiesToSchema({
    data: {
      type: "array",
      description:
        "The rows of the CSV, with a property for each header/column",
      items: {
        type: "object",
        additionalProperties: true,
      },
    },
  });

  async transform({ content }: BlockArg): Promise<unknown> {
    const { default: Papa } = await import("papaparse");
    const { data } = await Papa.parse(content);

    return {
      data,
    };
  }
}

registerBlock(new ParseCsv());
