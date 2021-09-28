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
import React from "react";
import { validateRegistryId } from "@/types/helpers";
import FormEditor from "@/components/formBuilder/FormEditor";
import { actions as elementWizardActions } from "@/devTools/editor/slices/formBuilderSlice";
import formBuilderSelectors from "@/devTools/editor/slices/formBuilderSelectors";
import useReduxState from "@/hooks/useReduxState";

export const FORM_RENDERER_ID = validateRegistryId("@pixiebrix/form");

const recordIdSchema: Schema = {
  type: "string",
  description: "Unique identifier for the data record",
};

const FormRendererOptions: React.FC<{
  name: string;
  configKey: string;
}> = ({ name, configKey }) => {
  const [activeField, setActiveField] = useReduxState(
    formBuilderSelectors.activeField,
    elementWizardActions.setActiveField
  );

  const configName = `${name}.${configKey}`;

  return (
    <div>
      <FormEditor
        name={configName}
        activeField={activeField}
        setActiveField={setActiveField}
      />

      <SchemaField
        name={`${configName}.recordId`}
        label="Record ID"
        schema={recordIdSchema}
      />
    </div>
  );
};

export default FormRendererOptions;
