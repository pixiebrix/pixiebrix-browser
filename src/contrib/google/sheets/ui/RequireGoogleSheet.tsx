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

import React, { type ReactElement, useEffect, useState } from "react";
import { type Spreadsheet } from "@/contrib/google/sheets/core/types";
import { type Schema } from "@/types/schemaTypes";
import useGoogleAccount from "@/contrib/google/sheets/core/useGoogleAccount";
import useSpreadsheetId from "@/contrib/google/sheets/core/useSpreadsheetId";
import useAsyncState from "@/hooks/useAsyncState";
import { dereference } from "@/validators/generic";
import { BASE_SHEET_SCHEMA } from "@/contrib/google/sheets/core/schemas";
import useDeriveAsyncState from "@/hooks/useDeriveAsyncState";
import { type SanitizedIntegrationConfig } from "@/integrations/integrationTypes";
import { sheets } from "@/background/messenger/api";
import { type AsyncState } from "@/types/sliceTypes";
import AsyncStateGate from "@/components/AsyncStateGate";
import { type Except } from "type-fest";
import { joinName } from "@/utils/formUtils";
import SchemaField from "@/components/fields/schemaFields/SchemaField";
import { isEmpty } from "lodash";
import { oauth2Storage } from "@/auth/authConstants";

type GoogleSheetState = {
  googleAccount: SanitizedIntegrationConfig | null;
  spreadsheet: Spreadsheet | null;
  spreadsheetFieldSchema: Schema;
};

const RequireGoogleSheet: React.FC<{
  blockConfigPath: string;
  children: (
    props: Except<GoogleSheetState, "spreadsheetFieldSchema">
  ) => ReactElement;
}> = ({ blockConfigPath, children }) => {
  const googleAccountAsyncState = useGoogleAccount();
  const spreadsheetIdAsyncState = useSpreadsheetId(blockConfigPath);
  const baseSchemaAsyncState = useAsyncState(
    dereference(BASE_SHEET_SCHEMA),
    [],
    {
      initialValue: BASE_SHEET_SCHEMA,
    }
  );

  const [loginController, setLoginController] =
    useState<AbortController | null>(null);

  function listenForLogin(googleAccount: SanitizedIntegrationConfig) {
    const loginController = new AbortController();
    oauth2Storage.onChanged((newValue) => {
      if (!isEmpty(newValue[googleAccount.id])) {
        googleAccountAsyncState.refetch();
        loginController.abort();
      }
    }, loginController.signal);
    setLoginController(loginController);
  }

  // Clean up the listener on unmount if it hasn't fired yet
  useEffect(
    () => () => {
      loginController?.abort();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on mount/unmount
    []
  );

  const resultAsyncState: AsyncState<GoogleSheetState> = useDeriveAsyncState(
    googleAccountAsyncState,
    spreadsheetIdAsyncState,
    baseSchemaAsyncState,
    async (
      googleAccount: SanitizedIntegrationConfig | null,
      spreadsheetId: string | null,
      baseSchema: Schema
    ) => {
      if (!spreadsheetId) {
        return {
          googleAccount,
          spreadsheet: null,
          spreadsheetFieldSchema: baseSchema,
        };
      }

      if (!googleAccount || (await sheets.isLoggedIn(googleAccount))) {
        return {
          googleAccount,
          // Sheets API will handle legacy authentication when googleAccount is null
          spreadsheet: await sheets.getSpreadsheet({
            googleAccount,
            spreadsheetId,
          }),
          spreadsheetFieldSchema: baseSchema,
        };
      }

      listenForLogin(googleAccount);

      return {
        googleAccount,
        spreadsheet: null,
        spreadsheetFieldSchema: baseSchema,
      };
    }
  );

  return (
    <AsyncStateGate state={resultAsyncState}>
      {({ data: { spreadsheetFieldSchema, ...others } }) => (
        <>
          <SchemaField
            name={joinName(blockConfigPath, "spreadsheetId")}
            schema={spreadsheetFieldSchema}
            isRequired
          />
          {children(others)}
        </>
      )}
    </AsyncStateGate>
  );
};

export default RequireGoogleSheet;
