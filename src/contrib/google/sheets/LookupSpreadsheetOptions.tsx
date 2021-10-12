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

import React, { useState } from "react";
import { BlockOptionProps } from "@/components/fields/schemaFields/genericOptionsFactory";
import { useField } from "formik";
import { Schema } from "@/core";
import { APPEND_SCHEMA } from "@/contrib/google/sheets/append";
import { joinName } from "@/utils";
import { SheetMeta } from "@/contrib/google/sheets/types";
import FileWidget from "@/contrib/google/sheets/FileWidget";
import ConnectedFieldTemplate from "@/components/form/ConnectedFieldTemplate";
import TabField from "@/contrib/google/sheets/TabField";
import { useAsyncState } from "@/hooks/common";
import { sheets } from "@/background/messenger/api";
import SchemaField from "@/components/fields/schemaFields/SchemaField";
import { getErrorMessage } from "@/errors";
import SwitchButtonWidget from "@/components/form/widgets/switchButton/SwitchButtonWidget";

const DEFAULT_HEADER_SCHEMA = {
  type: "string",
};

const HeaderField: React.FunctionComponent<{
  name: string;
  doc: SheetMeta | null;
  tabName: string;
}> = ({ name, tabName, doc }) => {
  const [headerSchema, , headersError] = useAsyncState(async () => {
    if (doc?.id && tabName) {
      const headers = await sheets.getHeaders({
        spreadsheetId: doc.id,
        tabName,
      });
      return {
        type: "string",
        enum: headers ?? [],
      };
    }

    return DEFAULT_HEADER_SCHEMA;
  }, [doc?.id, tabName]);

  return (
    <SchemaField
      name={name}
      label="Column Header"
      description={
        headersError ? (
          <span className="text-warning">
            Error determining columns: {getErrorMessage(headersError)}
          </span>
        ) : null
      }
      schema={(headerSchema ?? DEFAULT_HEADER_SCHEMA) as Schema}
    />
  );
};

const LookupSpreadsheetOptions: React.FunctionComponent<BlockOptionProps> = ({
  name,
  configKey,
}) => {
  const basePath = joinName(name, configKey);

  const [doc, setDoc] = useState<SheetMeta>(null);

  const [{ value: tabName }] = useField<string>(joinName(basePath, "tabName"));

  return (
    <div className="my-2">
      <ConnectedFieldTemplate
        name={joinName(basePath, "spreadsheetId")}
        label="Google Sheet"
        description="Select a Google Sheet"
        as={FileWidget}
        doc={doc}
        onSelect={setDoc}
      />
      <TabField
        name={joinName(basePath, "tabName")}
        schema={APPEND_SCHEMA.properties.tabName as Schema}
        doc={doc}
      />
      <HeaderField
        name={joinName(basePath, "header")}
        tabName={tabName}
        doc={doc}
      />
      <ConnectedFieldTemplate
        name={joinName(basePath, "query")}
        label="Query"
        description="Value to search for in the column"
      />
      <ConnectedFieldTemplate
        name={joinName(basePath, "multi")}
        label="All Matches"
        as={SwitchButtonWidget}
        description="Toggle on to return an array of matches"
      />
    </div>
  );
};

export default LookupSpreadsheetOptions;
