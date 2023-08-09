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

import React, { useState } from "react";
import { type BlockOptionProps } from "@/components/fields/schemaFields/genericOptionsFactory";
import { useField } from "formik";
import { type Expression } from "@/types/runtimeTypes";
import { type Schema } from "@/types/schemaTypes";
import TabField from "@/contrib/google/sheets/ui/TabField";
import SchemaField from "@/components/fields/schemaFields/SchemaField";
import { LOOKUP_SCHEMA } from "@/contrib/google/sheets/bricks/lookup";
import { isEmpty } from "lodash";
import { FormErrorContext } from "@/components/form/FormErrorContext";
import { requireGoogleHOC } from "@/contrib/google/sheets/ui/RequireGoogleApi";
import { makeTemplateExpression } from "@/runtime/expressionCreators";
import { isExpression } from "@/utils/expressionUtils";
import RequireGoogleSheet from "@/contrib/google/sheets/ui/RequireGoogleSheet";
import { type SanitizedIntegrationConfig } from "@/types/integrationTypes";
import { sheets } from "@/background/messenger/api";
import useAsyncEffect from "use-async-effect";
import hash from "object-hash";
import { joinName } from "@/utils/formUtils";
import useFlags from "@/hooks/useFlags";

function headerFieldSchemaForHeaders(headers: string[]): Schema {
  return {
    type: "string",
    title: "Column Header",
    description: "The column header to use for the lookup",
    enum: headers,
  };
}

const HeaderField: React.FunctionComponent<{
  name: string;
  googleAccount: SanitizedIntegrationConfig | null;
  spreadsheetId: string | null;
  tabName: string | Expression;
}> = ({ name, googleAccount, spreadsheetId, tabName }) => {
  const [{ value: header }, , { setValue: setHeader }] = useField<
    string | Expression
  >(name);

  const [fieldSchema, setFieldSchema] = useState<Schema>(
    headerFieldSchemaForHeaders([])
  );

  useAsyncEffect(
    async (isMounted) => {
      if (!spreadsheetId) {
        return;
      }

      const headers = await sheets.getHeaders({
        googleAccount,
        spreadsheetId,
        tabName: isExpression(tabName) ? tabName.__value__ : tabName,
      });

      if (!isMounted()) {
        return;
      }

      setFieldSchema(headerFieldSchemaForHeaders(headers));

      // Don't modify if it's a non-empty expression (user-typed text, or variable)
      if (isExpression(header) && !isEmpty(header.__value__)) {
        return;
      }

      // Set to empty nunjucks expression if no headers have loaded
      if (isEmpty(headers)) {
        await setHeader(makeTemplateExpression("nunjucks", ""));
        return;
      }

      // Don't modify if the header name is still valid
      if (typeof header === "string" && headers.includes(header)) {
        return;
      }

      // Remaining cases are either empty expression or invalid, selected header, so set to first header
      await setHeader(headers[0]);
    },
    // Hash just in case tabName is an expression, and we
    // don't need to run the effect when googleAccount changes,
    // because we can keep headers loaded if the new user
    // still has access to the same spreadsheetId and tabName.
    [hash({ spreadsheetId, tabName })]
  );

  return (
    <SchemaField
      name={name}
      schema={fieldSchema}
      isRequired
      defaultType="select"
    />
  );
};

const LookupSpreadsheetOptions: React.FunctionComponent<BlockOptionProps> = ({
  name,
  configKey,
}) => {
  const blockConfigPath = joinName(name, configKey);

  const [{ value: tabName }] = useField<string | Expression>(
    joinName(blockConfigPath, "tabName")
  );

  const { flagOn } = useFlags();

  return (
    <div className="my-2">
      {flagOn("gsheets-pkce-integration") && (
        <SchemaField
          name={joinName(blockConfigPath, "googleAccount")}
          schema={LOOKUP_SCHEMA.properties.googleAccount as Schema}
        />
      )}
      <RequireGoogleSheet blockConfigPath={blockConfigPath}>
        {({ googleAccount, spreadsheet, spreadsheetFieldSchema }) => (
          <>
            <FormErrorContext.Provider
              value={{
                shouldUseAnalysis: false,
                showUntouchedErrors: true,
                showFieldActions: false,
              }}
            >
              <SchemaField
                name={joinName(blockConfigPath, "spreadsheetId")}
                schema={spreadsheetFieldSchema}
                isRequired
              />
              {
                // The problem with including these inside the nested FormErrorContext.Provider is that we
                // would like analysis to run if they are in text/template mode, but not in select mode.
                // Select mode is more important, so we're leaving it like this for now.
                <>
                  <TabField
                    name={joinName(blockConfigPath, "tabName")}
                    schema={LOOKUP_SCHEMA.properties.tabName as Schema}
                    spreadsheet={spreadsheet}
                  />
                  <HeaderField
                    name={joinName(blockConfigPath, "header")}
                    googleAccount={googleAccount}
                    spreadsheetId={spreadsheet?.spreadsheetId}
                    tabName={tabName}
                  />
                </>
              }
            </FormErrorContext.Provider>
            <SchemaField
              name={joinName(blockConfigPath, "query")}
              label="Query"
              description="Value to search for in the column"
              schema={LOOKUP_SCHEMA.properties.query as Schema}
              isRequired
            />
            <SchemaField
              name={joinName(blockConfigPath, "multi")}
              label="All Matches"
              description="Toggle on to return an array of matches"
              schema={LOOKUP_SCHEMA.properties.multi as Schema}
              isRequired
            />
          </>
        )}
      </RequireGoogleSheet>
    </div>
  );
};

export default requireGoogleHOC(LookupSpreadsheetOptions);
