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

import React from "react";
import { Renderer } from "@/types";
import { BlockArg, BlockOptions, ComponentRef, Schema, UiSchema } from "@/core";
import JsonSchemaForm from "@rjsf/bootstrap-4";
import { JsonObject } from "type-fest";
import { dataStore } from "@/background/messenger/api";
import { reportError } from "@/telemetry/logging";
import { notifyResult } from "@/contentScript/notify";

import custom from "@/blocks/renderers/customForm.css?loadAsUrl";
import BootstrapStylesheet from "./BootstrapStylesheet";
import ImageCropWidget from "@/components/formBuilder/ImageCropWidget";
import ImageCropStylesheet from "@/blocks/renderers/ImageCropStylesheet";

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
    <BootstrapStylesheet />
    <ImageCropStylesheet />
    <link rel="stylesheet" href={custom} />
    <JsonSchemaForm
      schema={schema}
      uiSchema={uiSchema}
      formData={formData}
      widgets={uiWidgets}
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
  </div>
);

export class CustomFormRenderer extends Renderer {
  constructor() {
    super(
      "@pixiebrix/form",
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

  async render(
    { recordId, schema, uiSchema }: BlockArg,
    { logger }: BlockOptions
  ): Promise<ComponentRef> {
    const formData = await dataStore.get(recordId);

    console.debug("Building panel for record: [[ %s ]]", recordId);

    return {
      Component: CustomFormComponent,
      props: {
        recordId,
        formData,
        schema,
        uiSchema,
        onSubmit: async (values: JsonObject) => {
          try {
            await dataStore.set(recordId, values);
            notifyResult(logger.context.extensionId, {
              message: "Saved record",
              config: {
                className: "success",
              },
            });
          } catch (error) {
            reportError(error);
            notifyResult(logger.context.extensionId, {
              message: "Error saving record",
              config: {
                className: "error",
              },
            });
          }
        },
      },
    };
  }
}
