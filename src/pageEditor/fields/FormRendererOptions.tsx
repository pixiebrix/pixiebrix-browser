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
import React, { useCallback, useEffect, useState } from "react";
import { validateRegistryId } from "@/types/helpers";
import FormEditor from "@/components/formBuilder/edit/FormEditor";
import useReduxState from "@/hooks/useReduxState";
import ConfigErrorBoundary from "@/pageEditor/fields/ConfigErrorBoundary";
import { selectNodePreviewActiveElement } from "@/pageEditor/slices/editorSelectors";
import { actions as editorActions } from "@/pageEditor/slices/editorSlice";
import { useField, useFormikContext } from "formik";
import { joinName } from "@/utils";
import { partial } from "lodash";
import {
  customFormRendererSchema,
  type Storage,
} from "@/blocks/renderers/customForm";
import AppServiceField from "@/components/fields/schemaFields/AppServiceField";
import { type FormState } from "@/pageEditor/extensionPoints/formStateTypes";
import { produceExcludeUnusedDependencies } from "@/components/fields/schemaFields/serviceFieldUtils";
import FieldTemplate from "@/components/form/FieldTemplate";
import Select, { type Options } from "react-select";
import FORM_FIELD_TYPE_OPTIONS from "@/pageEditor/fields/formFieldTypeOptions";
import databaseSchema from "@schemas/database.json";

export const FORM_RENDERER_ID = validateRegistryId("@pixiebrix/form");

const recordIdSchema: Schema = {
  type: "string",
  description: "Unique identifier for the data record",
};

const databaseIdSchema: Schema = {
  $ref: databaseSchema.$id,
};

function usePruneUnusedServiceDependencies() {
  const { values: formState, setValues: setFormState } =
    useFormikContext<FormState>();

  return useCallback(() => {
    const nextState = produceExcludeUnusedDependencies(formState);

    setFormState(nextState);
  }, [formState, setFormState]);
}

const storageTypes = ["localStorage", "state", "database"];
const DEFAULT_STORAGE_TYPE = "state";

type StringOption = {
  label: string;
  value: string;
};
const storageTypeOptions: Options<StringOption> = storageTypes.map(
  (storageType) => ({
    label: storageType,
    value: storageType,
  })
);

const FormRendererOptions: React.FC<{
  name: string;
  configKey: string;
}> = ({ name, configKey }) => {
  const makeName = partial(joinName, name, configKey);
  const configName = makeName();

  const pruneDependencies = usePruneUnusedServiceDependencies();

  const [activeElement, setActiveElement] = useReduxState(
    selectNodePreviewActiveElement,
    editorActions.setNodePreviewActiveElement
  );

  const [{ value: storage }, , { setValue: setStorageValue }] =
    useField<Storage>(makeName("storage"));
  const storageType = storage?.type;

  // Sets the storage type and clears out any other values the user might have configured
  // If the next type is "database", the AppServiceField will initialize the "service" variable
  const changeStorageType = (nextStorageType: string) => {
    if (nextStorageType === "state") {
      setStorageValue({ type: "state", namespace: "blueprint" } as Storage);
    } else {
      setStorageValue({ type: nextStorageType } as Storage);
    }
  };

  // If the storage type changes from "database" to something else, ensure the service record at root is cleared
  const [previousStorageType, setPreviousStorageType] = useState(storageType);
  useEffect(() => {
    if (
      previousStorageType === "database" &&
      storageType !== previousStorageType
    ) {
      setPreviousStorageType(storageType);
      pruneDependencies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- useEffect is the only place that changes the previousStorageType, no need to depend on it
  }, [storageType, pruneDependencies]);

  // Set the default storage type
  if (storageType == null) {
    changeStorageType(DEFAULT_STORAGE_TYPE);
  }

  return (
    <div>
      <FieldTemplate
        name={makeName("storage", "type")}
        label="Type"
        description="The location to submit/store the form data"
        as={Select}
        options={storageTypeOptions}
        value={storageTypeOptions.find((x) => x.value === storageType)}
        onChange={({ value: nextStorageType }: StringOption) => {
          changeStorageType(nextStorageType);
        }}
      />

      {storageType === "database" && (
        <>
          <SchemaField
            name={makeName("storage", "databaseId")}
            label="Database"
            isRequired
            schema={databaseIdSchema}
          />
          <AppServiceField name={makeName("storage", "service")} />
        </>
      )}

      {storageType === "state" && (
        <SchemaField
          name={makeName("storage", "namespace")}
          isRequired
          schema={
            customFormRendererSchema.properties.storage.oneOf[1].properties
              .namespace as Schema
          }
        />
      )}

      {["localStorage", "database"].includes(storageType) && (
        <SchemaField
          name={makeName("recordId")}
          label="Record ID"
          schema={recordIdSchema}
          isRequired
        />
      )}

      <SchemaField
        name={makeName("successMessage")}
        label="Success Message"
        schema={customFormRendererSchema.properties.successMessage as Schema}
      />

      <ConfigErrorBoundary>
        <FormEditor
          name={configName}
          activeField={activeElement}
          setActiveField={setActiveElement}
          fieldTypes={FORM_FIELD_TYPE_OPTIONS}
        />
      </ConfigErrorBoundary>
    </div>
  );
};

export default FormRendererOptions;
