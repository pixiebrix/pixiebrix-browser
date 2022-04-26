/*
 * Copyright (C) 2022 PixieBrix, Inc.
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
import FormEditor from "@/components/formBuilder/edit/FormEditor";
import { actions as elementWizardActions } from "@/pageEditor/slices/formBuilderSlice";
import formBuilderSelectors from "@/pageEditor/slices/formBuilderSelectors";
import useReduxState from "@/hooks/useReduxState";
import ConfigErrorBoundary from "@/pageEditor/fields/ConfigErrorBoundary";
import { RootState } from "@/pageEditor/pageEditorTypes";
import { selectNodePreviewActiveElement } from "@/pageEditor/uiState/uiState";
import { actions as editorActions } from "@/pageEditor/slices/editorSlice";
import { DataPanelTabKey } from "@/pageEditor/tabs/editTab/dataPanel/dataPanelTypes";

export const FORM_RENDERER_ID = validateRegistryId("@pixiebrix/form");

const recordIdSchema: Schema = {
  type: "string",
  description: "Unique identifier for the data record",
};

const FormRendererOptions: React.FC<{
  name: string;
  configKey: string;
}> = ({ name, configKey }) => {
  const [activeElement, setActiveElement] = useReduxState(
    (state: RootState) =>
      selectNodePreviewActiveElement(state, DataPanelTabKey.Preview),
    (activeElement) =>
      editorActions.setNodePreviewActiveElement({
        tabKey: DataPanelTabKey.Preview,
        activeElement,
      })
  );

  const configName = `${name}.${configKey}`;

  return (
    <div>
      <ConfigErrorBoundary>
        <FormEditor
          name={configName}
          activeField={activeElement}
          setActiveField={setActiveElement}
        />
      </ConfigErrorBoundary>

      <SchemaField
        name={`${configName}.recordId`}
        label="Record ID"
        schema={recordIdSchema}
        isRequired
      />
    </div>
  );
};

export default FormRendererOptions;
