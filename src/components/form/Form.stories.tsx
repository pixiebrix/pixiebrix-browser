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
import * as yup from "yup";
import { ComponentMeta, ComponentStory } from "@storybook/react";
import Form, { OnSubmit } from "./Form";
import FormikHorizontalField from "./fields/FormikHorizontalField";
import FormikSwitchButton from "./fields/FormikSwitchButton";
import { action } from "@storybook/addon-actions";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGlobe } from "@fortawesome/free-solid-svg-icons";

const componentMeta: ComponentMeta<typeof Form> = {
  title: "Forms/Formik",
  component: Form,
  argTypes: {
    onSubmit: ((values, helpers) => {
      action("onSubmit")(values);
      helpers.setSubmitting(false);
    }) as OnSubmit,
    validateOnMount: {
      options: [true, false],
    },
  },
};

const SchemaShape: yup.ObjectSchema = yup.object().shape({
  title: yup.string().optional().oneOf(["Mr.", "Ms.", "Mrs.", "other"]),
  name: yup.string().required(),
  age: yup.number().required("What's your age again?").positive().integer(),
});

const initialValues = {
  title: "",
  name: "",
  age: "",
};

export const WithFormikHorizontalField: ComponentStory<typeof Form> = (
  args
) => (
  <Form validationSchema={SchemaShape} initialValues={initialValues} {...args}>
    <FormikHorizontalField placeholder="Title" name="title" />
    <FormikHorizontalField label="Name" name="name" description="A name" />
    <FormikHorizontalField label="Age" name="age" description="Your age" />
  </Form>
);
WithFormikHorizontalField.storyName = "With FormikHorizontalField";

export const CustomSubmit: ComponentStory<typeof Form> = (args) => (
  <Form
    validationSchema={SchemaShape}
    initialValues={initialValues}
    {...args}
    renderSubmit={() => <button type="submit">Click to submit</button>}
  >
    <FormikHorizontalField placeholder="Title" name="title" />
    <FormikHorizontalField label="Name" name="name" description="A name" />
    <FormikHorizontalField label="Age" name="age" description="Your age" />
  </Form>
);

const AllFieldsSchema: yup.ObjectSchema = yup.object().shape({
  name: yup.string().required(),
  story: yup.string(),
  public: yup.boolean(),
});
const allFieldsInitialValues = {
  name: "",
  story: "",
  public: false,
};
export const AllFields: ComponentStory<typeof Form> = (args) => (
  <Form
    validationSchema={AllFieldsSchema}
    initialValues={allFieldsInitialValues}
    {...args}
  >
    <FormikHorizontalField label="Name" name="name" description="A name" />
    <FormikHorizontalField
      label="Story"
      name="story"
      description="Tell me your story"
      type="textarea"
      rows={10}
    />
    <FormikSwitchButton
      label={
        <span>
          <FontAwesomeIcon icon={faGlobe} /> Public
        </span>
      }
      name="public"
    />
  </Form>
);

export default componentMeta;
