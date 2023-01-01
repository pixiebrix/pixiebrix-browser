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

import SchemaField from "@/components/fields/schemaFields/SchemaField";
import { type Schema } from "@/core";
import { joinName } from "@/utils";
import { partial } from "lodash";
import React from "react";
import AppServiceField from "@/components/fields/schemaFields/AppServiceField";
import databaseSchema from "@schemas/database.json";

const keySchema: Schema = {
  type: "string",
  title: "Key",
  description: "The unique key for the record",
};

const databaseIdSchema: Schema = {
  $ref: databaseSchema.$id,
};

const mergeStrategySchema: Schema = {
  type: "string",
  title: "Merge Strategy",
  description:
    "Strategy to update the record if it already exists (default: replace)",
  enum: ["replace", "shallow", "deep", "deep_append"],
  default: "replace",
};

const valueSchema: Schema = {
  type: "object",
  title: "Value",
  description: "The data to store in the database",
  additionalProperties: true,
};

const missingKeySchema: Schema = {
  type: "string",
  title: "Missing Behavior",
  description: "Behavior if the key does not exist",
  enum: ["blank", "error"],
  default: "error",
};

export type DatabaseGetPutOptionsProps = {
  name: string;
  configKey: string;
};

type DatabaseOptionsProps = DatabaseGetPutOptionsProps & {
  showValueField: boolean;
};

const DatabaseOptions: React.FC<DatabaseOptionsProps> = ({
  name,
  configKey,
  showValueField,
}) => {
  const configName = partial(joinName, name, configKey);

  return (
    <div>
      <SchemaField name={configName("key")} schema={keySchema} isRequired />
      <SchemaField
        name={configName("databaseId")}
        label="Database"
        schema={databaseIdSchema}
        isRequired
      />

      {showValueField ? (
        <>
          <SchemaField
            name={configName("mergeStrategy")}
            schema={mergeStrategySchema}
          />
          <SchemaField
            name={configName("value")}
            schema={valueSchema}
            isRequired
          />
        </>
      ) : (
        <SchemaField
          name={configName("missingKey")}
          schema={missingKeySchema}
        />
      )}

      <AppServiceField name={configName("service")} />
    </div>
  );
};

export default DatabaseOptions;
