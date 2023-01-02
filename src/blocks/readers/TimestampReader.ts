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

import { Reader } from "@/types";
import { type Schema } from "@/core";

class TimestampReader extends Reader {
  defaultOutputKey = "instant";

  constructor() {
    super(
      "@pixiebrix/timestamp",
      "Generate a timestamp",
      "Get the current date-time in multiple formats"
    );
  }

  async read() {
    const date = new Date();

    return {
      timestamp: date.toISOString(),
      epochMillis: date.getTime(),
    };
  }

  override async isRootAware(): Promise<boolean> {
    return false;
  }

  override outputSchema: Schema = {
    $schema: "https://json-schema.org/draft/2019-09/schema#",
    type: "object",
    properties: {
      timestamp: {
        type: "string",
        description:
          "Current ISO date-time in simplified extended ISO format (ISO 8601)",
        format: "date-time",
      },
      epochMillis: {
        type: "number",
        description:
          "The number of milliseconds between 1 January 1970 00:00:00 UTC and the given date",
      },
    },
  };

  async isAvailable() {
    return true;
  }
}

export default TimestampReader;
