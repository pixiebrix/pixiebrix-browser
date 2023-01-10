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

import React from "react";
import { type ComponentStory, type ComponentMeta } from "@storybook/react";
import OptionsBody from "./OptionsBody";
import { MemoryRouter } from "react-router";
import { action } from "@storybook/addon-actions";
// eslint-disable-next-line no-restricted-imports -- TODO: Fix over time
import { Formik } from "formik";
import { settingsStore } from "@/testUtils/storyUtils";
import { Provider } from "react-redux";

export default {
  title: "ActivateWizard/OptionsBody",
  component: OptionsBody,
} as ComponentMeta<typeof OptionsBody>;

const Template: ComponentStory<typeof OptionsBody> = (args) => (
  <Provider store={settingsStore()}>
    <MemoryRouter>
      <Formik initialValues={{ optionsArgs: {} }} onSubmit={action("onSubmit")}>
        <OptionsBody {...args} />
      </Formik>
    </MemoryRouter>
  </Provider>
);

export const TextField = Template.bind({});
TextField.args = {
  blueprint: {
    options: {
      schema: {
        properties: {
          textField: {
            title: "Text Field",
            type: "string",
            description: "This is a basic required text field.",
          },
        },
        required: ["textField"],
      },
    },
  },
};
