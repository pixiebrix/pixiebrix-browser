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

import { type ComponentMeta, type Story } from "@storybook/react";
import CssSpacingWidget from "@/components/fields/schemaFields/widgets/cssClassWidgets/CssSpacingWidget";
import type CssClassWidget from "@/components/fields/schemaFields/widgets/cssClassWidgets/CssClassWidget";
import { type Expression } from "@/types/runtimeTypes";
import { Provider } from "react-redux";
import { settingsStore } from "@/testUtils/storyUtils";
// eslint-disable-next-line no-restricted-imports
import { Formik, useField } from "formik";
import { action } from "@storybook/addon-actions";
import { getCssClassInputFieldOptions } from "@/components/fields/schemaFields/CssClassField";
import React from "react";
import { parseValue } from "@/components/fields/schemaFields/widgets/cssClassWidgets/utils";

export default {
  title: "Widgets/CssSpacingWidget",
  component: CssSpacingWidget,
} as ComponentMeta<typeof CssSpacingWidget>;

const Preview: React.VFC = () => {
  const [{ value }] = useField("cssClass");

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const { classes, isVar, includesTemplate } = parseValue(value);

  if (isVar || includesTemplate) {
    return <div>Preview not supported</div>;
  }

  return <div>Classes preview: {classes.join(" ")}</div>;
};

const Template: Story<
  typeof CssClassWidget & { initialValues: { cssClass: string | Expression } }
> = ({ initialValues }) => (
  <Provider store={settingsStore()}>
    <Formik initialValues={initialValues} onSubmit={action("submit")}>
      <>
        <div className="mb-4">
          <Preview />
        </div>
        <div>
          <CssSpacingWidget
            inputModeOptions={getCssClassInputFieldOptions()}
            schema={{
              type: "string",
            }}
            name="cssClass"
          />
        </div>
      </>
    </Formik>
  </Provider>
);

export const BlankLiteral = Template.bind({});
BlankLiteral.args = {
  initialValues: {
    cssClass: "",
  },
};
