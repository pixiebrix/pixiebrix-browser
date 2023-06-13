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

import {
  ensureGoogleToken,
  handleGoogleRequestRejection,
} from "@/contrib/google/auth";
import { columnToLetter } from "@/contrib/google/sheets/sheetsHelpers";
import { GOOGLE_SHEETS_SCOPES } from "@/contrib/google/sheets/sheetsConstants";
import { expectContext } from "@/utils/expectContext";
import initGoogle, {
  isGoogleInitialized,
  isGAPISupported,
  markGoogleInvalidated,
} from "@/contrib/google/initGoogle";

type AppendValuesResponse = gapi.client.sheets.AppendValuesResponse;
type BatchGetValuesResponse = gapi.client.sheets.BatchGetValuesResponse;
type BatchUpdateSpreadsheetResponse =
  gapi.client.sheets.BatchUpdateSpreadsheetResponse;
type Spreadsheet = gapi.client.sheets.Spreadsheet;
type SpreadsheetProperties = gapi.client.sheets.SpreadsheetProperties;

/**
 * Ensure GAPI is initialized and return the Google token.
 */
async function _ensureSheetsReadyOnce({
  interactive,
}: {
  interactive: boolean;
}): Promise<string> {
  expectContext("extension");

  if (!isGAPISupported()) {
    throw new Error("Google API not supported by browser");
  }

  if (!isGoogleInitialized()) {
    await initGoogle();
  }

  const token = await ensureGoogleToken(GOOGLE_SHEETS_SCOPES, {
    interactive,
  });

  if (!gapi.client.sheets) {
    markGoogleInvalidated();
    throw new Error("gapi sheets module not loaded");
  }

  return token;
}

export async function ensureSheetsReady({
  maxRetries = 3,
  interactive,
}: {
  maxRetries?: number;
  interactive: boolean;
}): Promise<string> {
  let retry = 0;
  let lastError;

  do {
    try {
      // eslint-disable-next-line no-await-in-loop -- retry loop
      return await _ensureSheetsReadyOnce({ interactive });
    } catch (error) {
      console.error("Error ensuring Google Sheets API ready", error, {
        retry,
      });
      lastError = error;
      retry++;
    }
  } while (retry < maxRetries);

  throw lastError;
}

export async function createTab(spreadsheetId: string, tabName: string) {
  const token = await ensureSheetsReady({ interactive: false });

  try {
    return (await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            addSheet: {
              properties: {
                title: tabName,
              },
            },
          },
        ],
      },
    })) as BatchUpdateSpreadsheetResponse;
  } catch (error) {
    throw await handleGoogleRequestRejection(token, error);
  }
}

export async function appendRows(
  spreadsheetId: string,
  tabName: string,
  values: any[]
) {
  const token = await ensureSheetsReady({ interactive: false });

  try {
    return (await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: tabName,
      valueInputOption: "USER_ENTERED",
      resource: {
        majorDimension: "ROWS",
        values,
      },
    })) as AppendValuesResponse;
  } catch (error) {
    throw await handleGoogleRequestRejection(token, error);
  }
}

export async function batchUpdate(spreadsheetId: string, requests: any[]) {
  const token = await ensureSheetsReady({ interactive: false });

  try {
    return (await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests,
      },
    })) as BatchUpdateSpreadsheetResponse;
  } catch (error) {
    throw await handleGoogleRequestRejection(token, error);
  }
}

export async function batchGet(
  spreadsheetId: string,
  ranges: string | string[]
) {
  const token = await ensureSheetsReady({ interactive: false });

  try {
    const sheetRequest = gapi.client.sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges,
    });
    return await new Promise<BatchGetValuesResponse>((resolve, reject) => {
      sheetRequest.execute((r) => {
        if (r.status >= 300 || (r as any).code >= 300) {
          reject(r);
        } else {
          resolve(r.result);
        }
      });
    });
  } catch (error) {
    throw await handleGoogleRequestRejection(token, error);
  }
}

export async function getSheetProperties(
  spreadsheetId: string
): Promise<SpreadsheetProperties> {
  const token = await ensureSheetsReady({ interactive: false });

  try {
    const sheetRequest = gapi.client.sheets.spreadsheets.get({
      spreadsheetId,
      fields: "properties",
    });
    const spreadsheet = await new Promise<Spreadsheet>((resolve, reject) => {
      // TODO: Find a better solution than casting to any
      sheetRequest.execute((r: any) => {
        // Response in practice doesn't match the type signature
        console.debug("Got spreadsheet response", r);
        if (r.code >= 300) {
          reject(
            new Error(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              r.message ?? `Google sheets request failed with status: ${r.code}`
            )
          );
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        resolve(r.result);
      });
    });

    if (!spreadsheet) {
      throw new Error("Unknown error fetching spreadsheet");
    }

    return spreadsheet.properties;
  } catch (error) {
    throw await handleGoogleRequestRejection(token, error);
  }
}

export async function getTabNames(spreadsheetId: string): Promise<string[]> {
  const token = await ensureSheetsReady({ interactive: false });

  try {
    const sheetRequest = gapi.client.sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties",
    });
    const spreadsheet = await new Promise<Spreadsheet>((resolve, reject) => {
      // TODO: Find a better solution than casting to any
      sheetRequest.execute((r: any) => {
        // Response in practice doesn't match the type signature
        console.debug("Got spreadsheet response", r);
        if (r.code >= 300) {
          reject(
            new Error(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              r.message ?? `Google sheets request failed with status: ${r.code}`
            )
          );
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        resolve(r.result);
      });
    });
    if (!spreadsheet) {
      throw new Error("Unknown error fetching spreadsheet");
    }

    return spreadsheet.sheets.map((x) => x.properties.title);
  } catch (error) {
    throw await handleGoogleRequestRejection(token, error);
  }
}

export async function getHeaders({
  spreadsheetId,
  tabName,
}: {
  spreadsheetId: string;
  tabName: string;
}): Promise<string[]> {
  // Lookup the headers in the first row so we can determine where to put the values
  const response = await batchGet(
    spreadsheetId,
    `${tabName}!A1:${columnToLetter(256)}1`
  );
  return response.valueRanges?.[0].values?.[0] ?? [];
}
