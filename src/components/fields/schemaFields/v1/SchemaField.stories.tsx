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
import { ComponentStory, ComponentMeta } from "@storybook/react";
import { Form, Formik } from "formik";
import SchemaField from "./SchemaField";
import { SchemaFieldProps } from "@/components/fields/schemaFields/propTypes";
import { Button } from "react-bootstrap";
import { getFieldNamesFromPathString } from "@/runtime/pathHelpers";
import { action } from "@storybook/addon-actions";

export default {
  title: "Fields/v1/SchemaField",
  component: SchemaField,
} as ComponentMeta<typeof SchemaField>;

const Template: ComponentStory<
  React.FunctionComponent<SchemaFieldProps & { defaultValue: unknown }>
> = (arguments_) => {
  const fieldName = getFieldNamesFromPathString(arguments_.name)[1];
  return (
    <Formik
      initialValues={{
        myStr: "abc",

        topObj: {
          myNum: 2,
          parentObj: {
            [fieldName]: arguments_.defaultValue,
          },
        },
      }}
      onSubmit={action("onSubmit")}
    >
      <Form>
        <SchemaField {...arguments_} />
        <Button type="submit">Submit</Button>
      </Form>
    </Formik>
  );
};

export const Boolean = Template.bind({});
Boolean.args = {
  name: "topObj.parentObj.testBoolean",
  defaultValue: false,
  label: "Switch this on or off",
  schema: {
    type: "boolean",
  },
};

export const NormalText = Template.bind({});
NormalText.args = {
  name: "topObj.parentObj.testField",
  defaultValue: "",
  label: "Enter some text",
  schema: {
    type: "string",
  },
};

export const SelectFromEnum = Template.bind({});
SelectFromEnum.args = {
  name: "topObj.parentObj.testField",
  label: "Select an option",
  defaultValue: null,
  schema: {
    type: "string",
    enum: ["Foo", "Bar"],
  },
};

export const CreatableSelect = Template.bind({});
CreatableSelect.args = {
  name: "topObj.parentObj.testField",
  label: "Select an option",
  defaultValue: null,
  schema: {
    type: "string",
    examples: ["Foo", "Bar"],
  },
};

export const TextArea = Template.bind({});
TextArea.args = {
  name: "topObj.parentObj.testField",
  label: "Write some text",
  defaultValue: "",
  schema: {
    type: "string",
    format: "markdown",
  },
};

export const ArrayItems = Template.bind({});
ArrayItems.args = {
  name: "topObj.parentObj.testField",
  label: "Add some array items",
  defaultValue: [],
  schema: {
    type: "array",
    items: {
      type: "string",
    },
  },
};

export const ObjectProperties = Template.bind({});
ObjectProperties.args = {
  name: "topObj.parentObj.testField",
  label: "Set the values for this object",
  defaultValue: {},
  schema: {
    type: "object",
    properties: {
      foo: {
        type: "string",
      },
      bar: {
        type: "number",
      },
      baz: {
        type: "boolean",
      },
      qux: {
        type: "string",
        enum: ["FOO", "BAR", "BAZ"],
      },
    },
  },
};
