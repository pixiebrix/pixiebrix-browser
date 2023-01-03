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

import { type Schema, type UiSchema } from "@/core";
import { waitForEffect } from "@/testUtils/testHelpers";
import testItRenders, {
  type ItRendersOptions,
} from "@/testUtils/testItRenders";
import { fireEvent, render, screen } from "@/pageEditor/testHelpers";
import React from "react";
import { type Except } from "type-fest";
import {
  createFormikTemplate,
  fireTextInput,
  fireFormSubmit,
  selectSchemaFieldType,
} from "@/testUtils/formHelpers";
import { type RJSFSchema } from "@/components/formBuilder/formBuilderTypes";
import FormEditor, { type FormEditorProps } from "./FormEditor";
import {
  initAddingFieldCases,
  initOneFieldSchemaCase,
  initRenamingCases,
} from "@/components/formBuilder/formEditor.testCases";
import selectEvent from "react-select-event";
import registerDefaultWidgets from "@/components/fields/schemaFields/widgets/registerDefaultWidgets";
import FORM_FIELD_TYPE_OPTIONS from "@/pageEditor/fields/formFieldTypeOptions";

const RJSF_SCHEMA_PROPERTY_NAME = "rjsfSchema";

jest.setTimeout(10_000); // This test is flaky with the default timeout of 5000 ms

beforeAll(() => {
  registerDefaultWidgets();
});

describe("FormEditor", () => {
  const defaultProps: Except<FormEditorProps, "activeField"> = {
    name: RJSF_SCHEMA_PROPERTY_NAME,
    setActiveField: jest.fn(),
    fieldTypes: FORM_FIELD_TYPE_OPTIONS,
  };

  describe("renders", () => {
    testItRenders({
      testName: "empty schema",
      Component: FormEditor,
      props: defaultProps,
      TemplateComponent: createFormikTemplate({
        [RJSF_SCHEMA_PROPERTY_NAME]: {} as RJSFSchema,
      }),
      isAsync: true,
      renderFn: render,
    });

    testItRenders(() => {
      const schema: Schema = {
        title: "A form",
        description: "A form example.",
        type: "object",
        properties: {
          firstName: {
            type: "string",
            title: "First name",
            default: "Chuck",
          },
          age: {
            type: "number",
            title: "Age",
          },
          telephone: {
            type: "string",
            title: "Telephone",
          },
        },
      };
      const uiSchema: UiSchema = {};

      const props: FormEditorProps = {
        ...defaultProps,
        activeField: "firstName",
      };

      const options: ItRendersOptions<FormEditorProps> = {
        testName: "simple schema",
        Component: FormEditor,
        props,
        TemplateComponent: createFormikTemplate({
          [RJSF_SCHEMA_PROPERTY_NAME]: {
            schema,
            uiSchema,
          } as RJSFSchema,
        }),
        isAsync: true,
        renderFn: render,
      };

      return options;
    });

    testItRenders(() => {
      const schema: Schema = {
        title: "A form",
        description: "A form example.",
        type: "object",
        properties: {
          unknown: {
            type: "string",
            title: "Unknown format",
            format: "unknown",
          },
        },
      };
      const uiSchema: UiSchema = {};

      const props: FormEditorProps = {
        ...defaultProps,
        activeField: "unknown",
      };

      const options: ItRendersOptions<FormEditorProps> = {
        testName: "unknown field format",
        Component: FormEditor,
        props,
        TemplateComponent: createFormikTemplate({
          [RJSF_SCHEMA_PROPERTY_NAME]: {
            schema,
            uiSchema,
          } as RJSFSchema,
        }),
        isAsync: true,
        renderFn: render,
      };

      return options;
    });
  });

  test("doesn't mark name field as invalid on blur", async () => {
    const fieldName = "firstName";
    const activeFieldTitle = "First name";

    const schema: Schema = {
      title: "A form",
      type: "object",
      properties: {
        [fieldName]: {
          type: "string",
          title: activeFieldTitle,
          default: "Chuck",
        },
      },
    };
    const FormikTemplate = createFormikTemplate({
      [RJSF_SCHEMA_PROPERTY_NAME]: {
        schema,
        uiSchema: {},
      } as RJSFSchema,
    });

    render(
      <FormikTemplate>
        <FormEditor activeField={fieldName} {...defaultProps} />
      </FormikTemplate>
    );

    await waitForEffect();

    const fieldNameInput = screen.getByLabelText("Name");
    fireEvent.focus(fieldNameInput);
    fireEvent.blur(fieldNameInput);

    await waitForEffect();

    const errorMessage = screen.queryByText(
      `Name must be unique. Another property "${activeFieldTitle}" already has the name "${fieldName}".`
    );
    expect(errorMessage).toBeNull();

    // Ensure the field is still active
    expect(screen.getByLabelText("Name")).not.toBeNull();
  });

  test("validates the field name is unique", async () => {
    const fieldName = "firstName";
    const anotherFieldName = "lastName";
    const anotherFieldTitle = "Another field";

    const schema: Schema = {
      title: "A form",
      type: "object",
      properties: {
        [fieldName]: {
          type: "string",
          title: "First name",
        },
        [anotherFieldName]: {
          type: "string",
          title: anotherFieldTitle,
        },
      },
    };
    const FormikTemplate = createFormikTemplate({
      [RJSF_SCHEMA_PROPERTY_NAME]: {
        schema,
        uiSchema: {},
      } as RJSFSchema,
    });

    render(
      <FormikTemplate>
        <FormEditor activeField={fieldName} {...defaultProps} />
      </FormikTemplate>
    );

    const fieldNameInput = screen.getByLabelText("Name");
    fireTextInput(fieldNameInput, anotherFieldName);

    await waitForEffect();

    const errorMessage = screen.getByText(
      `Name must be unique. Another property "${anotherFieldTitle}" already has the name "${anotherFieldName}".`
    );
    expect(errorMessage).not.toBeNull();

    // Ensure the field is still active
    expect(screen.getByLabelText("Name")).not.toBeNull();
  });

  test.each(initAddingFieldCases())(
    "adds a field",
    async (activeField, initialSchema, expectedSchema) => {
      const onSubmitMock = jest.fn();

      const FormikTemplate = createFormikTemplate(
        { [RJSF_SCHEMA_PROPERTY_NAME]: initialSchema },
        onSubmitMock
      );

      render(
        <FormikTemplate>
          <FormEditor activeField={activeField} {...defaultProps} />
        </FormikTemplate>
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: /add new field/i,
        })
      );
      await fireFormSubmit();

      expect(onSubmitMock).toHaveBeenCalledWith({
        [RJSF_SCHEMA_PROPERTY_NAME]: expectedSchema,
      });
    }
  );

  test("switches the required field", async () => {
    const fieldName = "firstName";
    const onSubmitMock = jest.fn();
    const FormikTemplate = createFormikTemplate(
      { [RJSF_SCHEMA_PROPERTY_NAME]: initOneFieldSchemaCase(fieldName) },
      onSubmitMock
    );

    const rendered = render(
      <FormikTemplate>
        <FormEditor activeField={fieldName} {...defaultProps} />
      </FormikTemplate>
    );

    const getRequiredFieldFromMock = (callNumber: number) =>
      (
        onSubmitMock.mock.calls[callNumber][0][
          RJSF_SCHEMA_PROPERTY_NAME
        ] as RJSFSchema
      ).schema.required;

    // Check the field is not required
    await fireFormSubmit();
    expect(getRequiredFieldFromMock(0)).toBeUndefined();

    // Make it required
    const requiredSwitch = rendered.container.querySelector(".switch.btn");
    fireEvent.click(requiredSwitch);

    // Check the field is required
    await fireFormSubmit();
    expect(getRequiredFieldFromMock(1)).toEqual([fieldName]);

    // Make it not required
    fireEvent.click(requiredSwitch);

    // Check the field is not required
    await fireFormSubmit();
    expect(getRequiredFieldFromMock(2)).toEqual([]);
  });

  test.each(initRenamingCases())(
    "renames a field",
    async (initialSchema, expectedSchema) => {
      const fieldName = "fieldToBeRenamed";
      const newFieldName = "newFieldName";

      const onSubmitMock = jest.fn();
      const FormikTemplate = createFormikTemplate(
        { [RJSF_SCHEMA_PROPERTY_NAME]: initialSchema },
        onSubmitMock
      );

      render(
        <FormikTemplate>
          <FormEditor activeField={fieldName} {...defaultProps} />
        </FormikTemplate>
      );

      const fieldNameInput = screen.getByLabelText("Name");
      fireTextInput(fieldNameInput, newFieldName);

      await fireFormSubmit();

      expect(onSubmitMock).toHaveBeenCalledWith({
        [RJSF_SCHEMA_PROPERTY_NAME]: expectedSchema,
      });
    }
  );

  test("clears the default value when switches uiType", async () => {
    const fieldName = "firstName";
    const onSubmitMock = jest.fn();
    const FormikTemplate = createFormikTemplate(
      { [RJSF_SCHEMA_PROPERTY_NAME]: initOneFieldSchemaCase(fieldName) },
      onSubmitMock
    );

    render(
      <FormikTemplate>
        <FormEditor activeField={fieldName} {...defaultProps} />
      </FormikTemplate>
    );

    await selectSchemaFieldType(
      `${RJSF_SCHEMA_PROPERTY_NAME}.schema.properties.${fieldName}.default`,
      "string"
    );

    const defaultValue = "Initial default value";
    const defaultValueInput = screen.getByLabelText("Default value");
    expect(defaultValueInput).not.toBeNull();
    fireTextInput(defaultValueInput, defaultValue);

    await fireFormSubmit();

    expect(onSubmitMock).toHaveBeenLastCalledWith({
      [RJSF_SCHEMA_PROPERTY_NAME]: expect.objectContaining({
        schema: expect.objectContaining({
          properties: {
            [fieldName]: expect.objectContaining({
              default: {
                __type__: "nunjucks",
                __value__: defaultValue,
              },
            }),
          },
        }),
      }),
    });

    await selectEvent.select(screen.getByLabelText("Input Type"), "File");

    await fireFormSubmit();

    expect(
      (
        (onSubmitMock.mock.calls[1][0][RJSF_SCHEMA_PROPERTY_NAME] as RJSFSchema)
          .schema.properties[fieldName] as Schema
      ).default
    ).toBeUndefined();
  });
});
