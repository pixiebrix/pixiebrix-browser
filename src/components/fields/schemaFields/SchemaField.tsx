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
import { SchemaFieldComponent } from "@/components/fields/schemaFields/propTypes";
import useApiVersionAtLeast from "@/devTools/editor/hooks/useApiVersionAtLeast";
import SchemaFieldV1 from "@/components/fields/schemaFields/v1/SchemaField";
import SchemaFieldV3 from "@/components/fields/schemaFields/v3/SchemaField";

/**
 * A schema-based field that automatically determines its layout/widget based on the schema and uiSchema.
 *
 * @see SchemaFieldContext
 * @see getDefaultField
 */
const SchemaField: SchemaFieldComponent = (props) => {
  const apiAtLeastV3 = useApiVersionAtLeast("v3");

  return apiAtLeastV3 ? (
    <SchemaFieldV3 {...props} />
  ) : (
    <SchemaFieldV1 {...props} />
  );
};

export default SchemaField;
