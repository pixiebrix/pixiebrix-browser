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

import SchemaField from "@/components/fields/schemaFields/SchemaField";
import ConnectedFieldTemplate from "@/components/form/ConnectedFieldTemplate";
import SelectWidget from "@/components/form/widgets/SelectWidget";
import { Schema } from "@/core";
import { useGetDatabasesQuery, useGetOrganizationsQuery } from "@/services/api";
import { validateRegistryId } from "@/types/helpers";
import { joinName } from "@/utils";
import { partial } from "lodash";
import React from "react";

export const DATABASE_GET_ID = validateRegistryId("@pixiebrix/data/get");

const keySchema: Schema = {
  type: "string",
  description: "The unique key for the record",
};

const databaseIdSchema: Schema = {
  type: "string",
  description: "The database id",
};

const DatabaseGetOptions: React.FC<{
  name: string;
  configKey: string;
}> = ({ name, configKey }) => {
  const configName = partial(joinName, name, configKey);
  const {
    data: databases,
    isLoading: isLoadingDatabases,
  } = useGetDatabasesQuery();
  const {
    data: organizations,
    isLoading: isLoadingOrganizations,
  } = useGetOrganizationsQuery();

  console.log("use", databases, organizations);

  const databaseOptions =
    databases && organizations
      ? databases.map((db) => {
          const organization = organizations.find(
            (o) => o.id === db.organization_id
          );
          const dbName = organization
            ? `${db.name} [${organization.name}]`
            : db.name;

          return {
            label: dbName,
            value: db.id,
          };
        })
      : [];

  return (
    <div>
      <SchemaField name={configName("key")} label="Key" schema={keySchema} />

      <ConnectedFieldTemplate
        name={configName("databaseId")}
        label="Database Id"
        as={SelectWidget}
        options={databaseOptions}
        isLoading={isLoadingDatabases || isLoadingOrganizations}
      />

      <ConnectedFieldTemplate
        name={configName("service")}
        label={"Service"}
        placeholder="@pixiebrix/api"
      />

      <SchemaField
        name={configName("databaseId")}
        label="Database Id"
        schema={databaseIdSchema}
      />
    </div>
  );
};

export default DatabaseGetOptions;
