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
import { type SchemaFieldComponent } from "@/components/fields/schemaFields/propTypes";
import BasicSchemaField from "@/components/fields/schemaFields/BasicSchemaField";
import AppServiceField from "@/components/fields/schemaFields/AppServiceField";
import CssClassField from "./CssClassField";
import HeadingStyleField from "./HeadingStyleField";
import {
  isAppServiceField,
  isButtonVariantField,
  isCssClassField,
  isHeadingStyleField,
} from "./fieldTypeCheckers";
import RootAwareField from "@/components/fields/schemaFields/RootAwareField";
import ButtonVariantSchemaField from "@/components/fields/schemaFields/ButtonVariantSchemaField";

const SchemaField: SchemaFieldComponent = (props) => {
  const { schema, uiSchema } = props;

  if (isAppServiceField(schema)) {
    return <AppServiceField {...props} />;
  }

  if (isCssClassField(schema)) {
    return <CssClassField {...props} />;
  }

  if (isHeadingStyleField(schema)) {
    return <HeadingStyleField {...props} />;
  }

  if (isButtonVariantField(uiSchema)) {
    return <ButtonVariantSchemaField {...props} />;
  }

  if (props.name.endsWith(".isRootAware")) {
    // Hide the isRootAware field if rendered as part of config.isRootAware. The field was introduced for
    // backward compatibility when upgrading DOM bricks to be root-aware.
    return <RootAwareField {...props} />;
  }

  return <BasicSchemaField {...props} />;
};

export default SchemaField;
