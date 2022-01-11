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
import { Schema, UUID } from "@/core";
import { joinName } from "@/utils";
import { partial } from "lodash";
import React, { useEffect, useRef, useState } from "react";
import useDatabaseOptions from "@/devTools/editor/hooks/useDatabaseOptions";
import createMenuListWithAddButton from "@/components/form/widgets/createMenuListWithAddButton";
import DatabaseCreateModal from "./DatabaseCreateModal";
import AppServiceField from "@/components/fields/schemaFields/AppServiceField";
import { PIXIEBRIX_SERVICE_ID } from "@/services/constants";
import { useField } from "formik";
import { SERVICE_BASE_SCHEMA } from "@/services/serviceUtils";

const keySchema: Schema = {
  type: "string",
  title: "Key",
  description: "The unique key for the record",
};

const valueSchema: Schema = {
  type: "object",
  title: "Value",
  description: "The data to store in the database",
  additionalProperties: true,
};

const serviceSchema: Schema = {
  $ref: `${SERVICE_BASE_SCHEMA}${PIXIEBRIX_SERVICE_ID}`,
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
  const databaseFieldName = configName("databaseId");

  const [showModal, setShowModal] = useState(false);
  const { setValue: setDatabaseId } = useField<UUID>(databaseFieldName)[2];

  const {
    databaseOptions,
    isLoading: isLoadingDatabaseOptions,
  } = useDatabaseOptions();

  const isMountedRef = useRef(true);
  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    []
  );

  const onModalClose = () => {
    if (!isMountedRef.current) {
      return;
    }

    setShowModal(false);
  };

  const onDatabaseCreated = (databaseId: UUID) => {
    if (!isMountedRef.current) {
      return;
    }

    onModalClose();
    setDatabaseId(databaseId);
  };

  return (
    <div>
      {showModal && (
        <DatabaseCreateModal
          onClose={onModalClose}
          onDatabaseCreated={onDatabaseCreated}
        />
      )}

      <ConnectedFieldTemplate
        name={databaseFieldName}
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

      <SchemaField name={configName("key")} schema={keySchema} isRequired />

      {showValueField && (
        <SchemaField
          name={configName("value")}
          schema={valueSchema}
          isRequired
        />
      )}

      <AppServiceField name={configName("service")} schema={serviceSchema} />
    </div>
  );
};

export default DatabaseOptions;
