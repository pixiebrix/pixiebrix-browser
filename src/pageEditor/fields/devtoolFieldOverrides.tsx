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
import SelectorSelectorWidget, {
  type SelectorSelectorProps,
} from "@/pageEditor/fields/SelectorSelectorWidget";
import { type Schema } from "@/types/schemaTypes";
import OptionIcon from "@/components/fields/schemaFields/optionIcon/OptionIcon";
import { type CustomFieldDefinitions } from "@/components/fields/schemaFields/schemaFieldTypes";
import { isTemplateExpression } from "@/utils/expressionUtils";
import { customWidgets } from "@/components/fields/schemaFields/SchemaFieldContext";

const ClearableSelectorWidget: React.FunctionComponent<
  SelectorSelectorProps
> = (props) => <SelectorSelectorWidget {...props} isClearable sort />;

const isSelectorField = (schema: Schema) =>
  schema.type === "string" && schema.format === "selector";

const devtoolFieldOverrides: CustomFieldDefinitions = {
  customToggleModes: [
    {
      match: isSelectorField,
      option: {
        label: "Selector",
        value: "string",
        symbol: <OptionIcon icon="querySelector" />,
        Widget: ClearableSelectorWidget,
        interpretValue(oldValue: unknown) {
          if (typeof oldValue === "string") {
            return oldValue;
          }

          if (isTemplateExpression(oldValue)) {
            return oldValue.__value__;
          }

          return "";
        },
      },
    },
  ],
  customWidgets,
};

export default devtoolFieldOverrides;
