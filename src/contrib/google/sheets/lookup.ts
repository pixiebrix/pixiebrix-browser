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

import { validateRegistryId } from "@/types/helpers";
import { sheets } from "@/background/messenger/api";
import { propertiesToSchema } from "@/validators/generic";
import { zip } from "lodash";
import { isNullOrBlank } from "@/utils";
import { BusinessError } from "@/errors/businessErrors";
import { SHEET_SERVICE_SCHEMA } from "@/contrib/google/sheets/schemas";
import { type Schema } from "@/types/schemaTypes";
import { TransformerABC } from "@/types/bricks/transformerTypes";
import { type SanitizedIntegrationConfig } from "@/types/integrationTypes";
import { type BrickArgs, type BrickOptions } from "@/types/runtimeTypes";
import { type UnknownObject } from "@/types/objectTypes";
import { type SpreadsheetTarget } from "@/contrib/google/sheets/handlers";

export const GOOGLE_SHEETS_LOOKUP_ID = validateRegistryId(
  "@pixiebrix/google/sheets-lookup"
);

export const LOOKUP_SCHEMA: Schema = propertiesToSchema(
  {
    spreadsheetId: {
      // Spreadsheet ID or service config
      oneOf: [
        // First one here should be BASE_SHEET_SCHEMA,
        // but the runtime can't dereference it properly
        {
          type: "string",
          minLength: 1,
        },
        SHEET_SERVICE_SCHEMA,
      ],
    },
    tabName: {
      type: "string",
      description: "The tab name of the spreadsheet to lookup the value.",
    },
    header: {
      type: "string",
      description: "The header of the column to lookup the value",
    },
    multi: {
      type: "boolean",
      description:
        "True to return all matches, false to return the first match",
      default: false,
    },
    query: {
      type: ["string", "number", "boolean"],
      description: "The value to lookup",
    },
  },
  ["spreadsheetId", "tabName", "header", "query"]
);

export class GoogleSheetsLookup extends TransformerABC {
  constructor() {
    super(
      GOOGLE_SHEETS_LOOKUP_ID,
      "Lookup Google Sheet row",
      "Lookup rows in in a Google Sheet"
    );
  }

  defaultOutputKey = "row";

  inputSchema: Schema = LOOKUP_SCHEMA;

  async transform(
    {
      spreadsheetId: spreadsheetIdArg,
      tabName,
      header,
      query,
      multi,
    }: BrickArgs<{
      spreadsheetId: string | SanitizedIntegrationConfig;
      tabName: string;
      header: string;
      query: string | number | boolean;
      multi: boolean;
    }>,
    { logger }: BrickOptions
  ): Promise<UnknownObject | UnknownObject[]> {
    const spreadsheetId =
      typeof spreadsheetIdArg === "string"
        ? spreadsheetIdArg
        : spreadsheetIdArg.config.spreadsheetId;
    const target: SpreadsheetTarget = {
      googleAccount: null,
      spreadsheetId,
      tabName,
    };
    const valueRange = await sheets.getAllRows(target);
    const [headers, ...rows] = valueRange?.values ?? [[], []];

    logger.debug(`Tab ${tabName} has headers`, { headers });

    const columnIndex = headers.indexOf(header);
    if (columnIndex < 0) {
      throw new BusinessError(`Header ${header} not found`);
    }

    const matchData = rows.filter((x) => x.at(columnIndex) === query);
    const matchRecords = matchData.map((row) =>
      Object.fromEntries(
        zip(headers, row).filter(([rowHeader]) => !isNullOrBlank(rowHeader))
      )
    );

    if (multi) {
      return matchRecords;
    }

    return matchRecords[0];
  }
}
