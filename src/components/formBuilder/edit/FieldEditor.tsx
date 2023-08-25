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

import { useField } from "formik";
import React, { type ChangeEvent, useEffect, useMemo, useState } from "react";
import styles from "./FieldEditor.module.scss";
import {
  type RJSFSchema,
  type SelectStringOption,
  type SetActiveField,
} from "@/components/formBuilder/formBuilderTypes";
import { UI_WIDGET } from "@/components/formBuilder/schemaFieldNames";
import {
  FIELD_TYPES_WITHOUT_DEFAULT,
  parseUiType,
  produceSchemaOnPropertyNameChange,
  produceSchemaOnUiTypeChange,
  replaceStringInArray,
  stringifyUiType,
  type UiType,
  type UiTypeExtra,
  validateNextPropertyName,
} from "@/components/formBuilder/formBuilderHelpers";
import FieldTemplate from "@/components/form/FieldTemplate";
import { produce } from "immer";
import SelectWidget, {
  type SelectWidgetOnChange,
} from "@/components/form/widgets/SelectWidget";
import SwitchButtonWidget, {
  type CheckBoxLike,
} from "@/components/form/widgets/switchButton/SwitchButtonWidget";
import { uniq } from "lodash";
import { type SchemaFieldProps } from "@/components/fields/schemaFields/propTypes";
import SchemaField from "@/components/fields/schemaFields/SchemaField";
import databaseSchema from "@schemas/database.json";
import googleSheetIdSchema from "@schemas/googleSheetId.json";
import {
  isDatabaseField,
  isGoogleSheetIdField,
} from "@/components/fields/schemaFields/fieldTypeCheckers";
import { type Schema, type SchemaPropertyType } from "@/types/schemaTypes";
import { AnnotationType } from "@/types/annotationTypes";
import { isNullOrBlank } from "@/utils/stringUtils";

const imageForCroppingSourceSchema: Schema = {
  type: "string",
  description:
    "The source image data URI: https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs",
};

const UNKNOWN_OPTION: SelectStringOption = {
  label: "unknown",
  value: null,
};

const FieldEditor: React.FC<{
  name: string;
  propertyName: string;
  setActiveField: SetActiveField;
  fieldTypes: SelectStringOption[];
}> = ({ name, propertyName, setActiveField, fieldTypes }) => {
  const [{ value: rjsfSchema }, , { setValue: setRjsfSchema }] =
    useField<RJSFSchema>(name);
  const { schema, uiSchema } = rjsfSchema;
  const fullPropertyName = `${name}.schema.properties.${propertyName}`;
  const [{ value: propertySchema }] = useField<Schema>(fullPropertyName);
  const getFullFieldName = (fieldName: string) =>
    `${fullPropertyName}.${fieldName}`;

  const [internalPropertyName, setInternalPropertyName] = useState<string>("");
  const [propertyNameError, setPropertyNameError] = useState<string>(null);
  useEffect(() => {
    setInternalPropertyName(propertyName);
    setPropertyNameError(null);
  }, [propertyName, schema]);

  const propertyNameAnnotations = useMemo(
    () =>
      isNullOrBlank(propertyNameError)
        ? []
        : [{ message: propertyNameError, type: AnnotationType.Error }],
    [propertyNameError]
  );

  const validatePropertyName = (nextName: string) => {
    const error = validateNextPropertyName(schema, propertyName, nextName);

    setPropertyNameError(error);

    return error;
  };

  const onPropertyNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextName = event.target.value;
    validatePropertyName(nextName);
    setInternalPropertyName(nextName);
  };

  const updatePropertyName = async () => {
    const nextName = internalPropertyName;
    if (nextName === propertyName) {
      return;
    }

    const error = validatePropertyName(nextName);
    if (error) {
      return;
    }

    const nextRjsfSchema = produceSchemaOnPropertyNameChange(
      rjsfSchema,
      propertyName,
      nextName
    );
    await setRjsfSchema(nextRjsfSchema);
    setActiveField(nextName);
  };

  const onUiTypeChange: SelectWidgetOnChange = async (event) => {
    const { value } = event.target;
    if (!value) {
      return;
    }

    const nextRjsfSchema = produceSchemaOnUiTypeChange(
      rjsfSchema,
      propertyName,
      value
    );

    await setRjsfSchema(nextRjsfSchema);
  };

  const getSelectedUiTypeOption = () => {
    const fieldSchema = schema.properties[propertyName];
    if (typeof fieldSchema === "boolean") {
      return UNKNOWN_OPTION;
    }

    const isDatabaseFieldType = isDatabaseField(fieldSchema);
    const isGoogleSheetFieldType = isGoogleSheetIdField(fieldSchema);

    const propertyType =
      isDatabaseFieldType || isGoogleSheetFieldType
        ? "string"
        : (propertySchema.type as SchemaPropertyType);

    const uiWidget = isDatabaseFieldType
      ? "database"
      : isGoogleSheetFieldType
      ? "googleSheet"
      : uiSchema?.[propertyName]?.[UI_WIDGET];

    const propertyFormat = propertySchema.format;
    const extra: UiTypeExtra =
      uiWidget === "select" && propertySchema.oneOf !== undefined
        ? "selectWithLabels"
        : undefined;

    const uiType = stringifyUiType({
      propertyType,
      uiWidget,
      propertyFormat,
      extra,
    });

    const selected = fieldTypes.find((option) => option.value === uiType);

    return selected ?? UNKNOWN_OPTION;
  };

  const onRequiredChange = async ({
    target: { value: nextIsRequired },
  }: React.ChangeEvent<CheckBoxLike>) => {
    const nextRjsfSchema = produce(rjsfSchema, (draft) => {
      if (!draft.schema.required) {
        draft.schema.required = [];
      }

      if (nextIsRequired) {
        draft.schema.required.push(propertyName);
        draft.schema.required = uniq(draft.schema.required);
      } else {
        draft.schema.required = replaceStringInArray(
          draft.schema.required,
          propertyName
        );
      }
    });

    await setRjsfSchema(nextRjsfSchema);
  };

  const isRequired = (schema.required ?? []).includes(propertyName);

  const selectedUiTypeOption = getSelectedUiTypeOption();

  const labelFieldProps: SchemaFieldProps = {
    name: getFullFieldName("title"),
    schema: {
      type: "string",
      description: "The user-visible label for this field",
    },
    label: "Label",
  };
  const descriptionFieldProps: SchemaFieldProps = {
    name: getFullFieldName("description"),
    schema: {
      type: "string",
      description: "The user-visible description for the field",
    },
    label: "Field Description",
  };

  const uiType: UiType =
    selectedUiTypeOption.value == null
      ? {
          propertyType: "null",
          uiWidget: undefined,
          propertyFormat: undefined,
          extra: undefined,
        }
      : parseUiType(selectedUiTypeOption.value);

  const defaultFieldProps: SchemaFieldProps =
    selectedUiTypeOption.value == null
      ? null
      : {
          name: getFullFieldName("default"),
          schema:
            uiType.uiWidget === "database"
              ? {
                  $ref: databaseSchema.$id,
                }
              : uiType.uiWidget === "googleSheet"
              ? {
                  $ref: googleSheetIdSchema.$id,
                }
              : {
                  type: uiType.propertyType,
                },
          label: "Default value",
          description:
            uiType.extra === "selectWithLabels"
              ? 'Should match one of the "const" values from the "Options" field'
              : undefined,
        };

  return (
    <div className={styles.root}>
      <FieldTemplate
        required
        name={fullPropertyName}
        label="Name"
        value={internalPropertyName}
        onChange={onPropertyNameChange}
        onBlur={updatePropertyName}
        touched
        annotations={propertyNameAnnotations}
        description="Enter a name to refer to this value in the output later"
      />
      <SchemaField {...labelFieldProps} />
      <SchemaField {...descriptionFieldProps} />
      <FieldTemplate
        name={getFullFieldName("uiType")}
        label="Input Type"
        as={SelectWidget}
        blankValue={null}
        options={fieldTypes}
        value={selectedUiTypeOption.value}
        onChange={onUiTypeChange}
      />

      {uiType.uiWidget === "imageCrop" && (
        <SchemaField
          label="Image source"
          name={`${name}.uiSchema.${propertyName}.source`}
          schema={imageForCroppingSourceSchema}
        />
      )}

      {defaultFieldProps &&
        !FIELD_TYPES_WITHOUT_DEFAULT.includes(selectedUiTypeOption.value) && (
          <SchemaField {...defaultFieldProps} />
        )}

      {propertySchema.enum && (
        <>
          <SchemaField
            label="Options"
            name={getFullFieldName("enum")}
            schema={{
              type: "array",
              items: {
                type: "string",
              },
            }}
            isRequired
          />
        </>
      )}

      {propertySchema.type === "array" && (
        <>
          <SchemaField
            label="Options"
            name={getFullFieldName("items.enum")}
            schema={{
              type: "array",
              items: {
                type: "string",
              },
            }}
            isRequired
          />
        </>
      )}

      {propertySchema.oneOf && (
        <SchemaField
          label="Options"
          name={getFullFieldName("oneOf")}
          schema={{
            type: "array",
            items: {
              type: "object",
              properties: {
                const: { type: "string" },
                title: { type: "string" },
              },
              required: ["const"],
            },
          }}
          isRequired
        />
      )}

      <FieldTemplate
        name={`${name}.schema.required`}
        label="Required Field?"
        as={SwitchButtonWidget}
        value={isRequired}
        onChange={onRequiredChange}
      />
    </div>
  );
};

export default FieldEditor;
