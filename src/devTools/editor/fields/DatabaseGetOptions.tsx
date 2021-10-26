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
import { joinName } from "@/utils";
import { partial } from "lodash";
import React, { useState } from "react";
import useDatabaseOptions from "@/devTools/editor/hooks/useDatabaseOptions";
import { validateRegistryId } from "@/types/helpers";
import createMenuListWithAddButton from "@/components/createMenuListWithAddButton";
import DatabaseCreateModal from "./DatabaseCreateModal";
import AppServiceField from "@/components/fields/schemaFields/AppServiceField";

export const DATABASE_GET_ID = validateRegistryId("@pixiebrix/data/get");

const keySchema: Schema = {
  type: "string",
  description: "The unique key for the record",
};

const serviceSchema: Schema = {
  $ref: "https://app.pixiebrix.com/schemas/services/@pixiebrix/api",
};

const DatabaseGetOptions: React.FC<{
  name: string;
  configKey: string;
}> = ({ name, configKey }) => {
  const [showModal, setShowModal] = useState(false);

  const configName = partial(joinName, name, configKey);

  const {
    databaseOptions,
    isLoading: isLoadingDatabaseOptions,
  } = useDatabaseOptions();

  return (
    <div>
      {showModal && (
        <DatabaseCreateModal
          onClose={() => {
            setShowModal(false);
          }}
        />
      )}

      <ConnectedFieldTemplate
        name={configName("databaseId")}
        label="Database"
        as={SelectWidget}
        options={databaseOptions}
        isLoading={isLoadingDatabaseOptions}
        components={{
          MenuList: createMenuListWithAddButton(() => {
            setShowModal(true);
          }),
        }}
      />

      <SchemaField name={configName("key")} label="Key" schema={keySchema} />

      <AppServiceField
        name={configName("service")}
        label="Service"
        schema={serviceSchema}
      />
    </div>
  );
};

export default DatabaseGetOptions;
