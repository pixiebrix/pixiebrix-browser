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

import React from "react";
import { Renderer } from "@/types";
import { BlockArg, ComponentRef, Schema, UiSchema } from "@/core";
import JsonSchemaForm from "@rjsf/bootstrap-4";
import { JsonObject } from "type-fest";
import { dataStore } from "@/background/messenger/api";
import notify from "@/utils/notify";
import custom from "@/blocks/renderers/customForm.css?loadAsUrl";
import BootstrapStylesheet from "./BootstrapStylesheet";
import ImageCropWidget from "@/components/formBuilder/ImageCropWidget";
import ImageCropStylesheet from "@/blocks/renderers/ImageCropStylesheet";
// eslint-disable-next-line import/no-named-as-default -- need default export here
import DescriptionField from "@/components/formBuilder/DescriptionField";
import FieldTemplate from "@/components/formBuilder/FieldTemplate";
import ErrorBoundary from "@/components/ErrorBoundary";
import { validateRegistryId } from "@/types/helpers";

const fields = {
  DescriptionField,
};
const uiWidgets = {
  imageCrop: ImageCropWidget,
};

const CustomFormComponent: React.FunctionComponent<{
  schema: Schema;
  uiSchema: UiSchema;
  formData: JsonObject;
  onSubmit: (values: JsonObject) => Promise<void>;
}> = ({ schema, uiSchema, formData, onSubmit }) => (
  <div className="CustomForm p-3">
    <ErrorBoundary>
      <BootstrapStylesheet />
      <ImageCropStylesheet />
      <link rel="stylesheet" href={custom} />
      <JsonSchemaForm
        schema={schema}
        uiSchema={uiSchema}
        formData={formData}
        fields={fields}
        widgets={uiWidgets}
        FieldTemplate={FieldTemplate}
        onSubmit={async ({ formData }) => {
          await onSubmit(formData);
        }}
      >
        <div>
          <button className="btn btn-primary" type="submit">
            Save
          </button>
        </div>
      </JsonSchemaForm>
    </ErrorBoundary>
  </div>
);

export class CustomFormRenderer extends Renderer {
  static BLOCK_ID = validateRegistryId("@pixiebrix/form");
  constructor() {
    super(
      CustomFormRenderer.BLOCK_ID,
      "Custom Form",
      "Show a custom form connected to a data source"
    );
  }

  inputSchema: Schema = {
    type: "object",
    properties: {
      recordId: {
        type: "string",
        description: "Unique identifier for the data record",
      },
      schema: {
        type: "object",
        additionalProperties: true,
      },
      uiSchema: {
        type: "object",
        additionalProperties: true,
      },
    },
  };

  async render({
    recordId,
    schema,
    uiSchema,
  }: BlockArg): Promise<ComponentRef> {
    const formData = await dataStore.get(recordId);

    console.debug("Building panel for record: [[ %s ]]", recordId);

    return {
      Component: CustomFormComponent,
      props: {
        recordId,
        formData,
        schema,
        uiSchema,
        async onSubmit(values: JsonObject) {
          try {
            await dataStore.set(recordId, values);
            notify.success("Saved record");
          } catch (error) {
            notify.error({
              error,
              message: "Error saving record",
              reportError: false,
            });
          }
        },
      },
    };
  }
}
