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
import { Schema } from "@/core";
import React, { useEffect } from "react";
import { validateRegistryId } from "@/types/helpers";
import { actions as formBuilderActions } from "@/devTools/editor/slices/formBuilderSlice";
import formBuilderSelectors from "@/devTools/editor/slices/formBuilderSelectors";
import FormEditor from "@/components/formBuilder/FormEditor";
import useReduxState from "@/hooks/useReduxState";
import ConfigErrorBoundary from "@/devTools/editor/fields/ConfigErrorBoundary";

export const FORM_MODAL_ID = validateRegistryId("@pixiebrix/form-modal");

const cancelableSchema: Schema = {
  type: "boolean",
  description: "Whether or not the user can cancel the form (default=true)",
  default: true,
};

const submitCaptionSchema: Schema = {
  type: "string",
  description: "The submit button caption (default='Submit')",
  default: "Submit",
};

const locationSchema: Schema = {
  type: "string",
  enum: ["modal", "sidebar"],
  description: "The location of the form (default='modal')",
  default: "modal",
};

const FormModalOptions: React.FC<{
  name: string;
  configKey: string;
}> = ({ name, configKey }) => {
  const [activeField, setActiveField] = useReduxState(
    formBuilderSelectors.activeField,
    formBuilderActions.setActiveField
  );

  const configName = `${name}.${configKey}`;

  useEffect(
    () => () => {
      // Clean up selected field on destroy
      setActiveField(null);
    },
    [configName]
  );

  return (
    <div>
      <ConfigErrorBoundary>
        <FormEditor
          name={configName}
          activeField={activeField}
          setActiveField={setActiveField}
        />
      </ConfigErrorBoundary>

      <SchemaField
        name={`${configName}.cancelable`}
        label="Cancelable?"
        schema={cancelableSchema}
      />

      <SchemaField
        name={`${configName}.submitCaption`}
        label="Submit Button Text"
        schema={submitCaptionSchema}
      />

      <SchemaField
        name={`${configName}.location`}
        label="Location"
        schema={locationSchema}
      />
    </div>
  );
};

export default FormModalOptions;
