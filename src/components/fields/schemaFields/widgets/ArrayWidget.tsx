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

import { SchemaFieldProps } from "@/components/fields/schemaFields/propTypes";
import { FieldArray, useField } from "formik";
import { Button } from "react-bootstrap";
import React from "react";
import { Schema } from "@/core";
import {
  booleanPredicate,
  findOneOf,
  textPredicate,
} from "@/components/fields/schemaFields/schemaUtils";
import { UnknownObject } from "@/types";
import { defaultBlockConfig } from "@/blocks/util";
import SchemaField from "@/components/fields/schemaFields/SchemaField";
import { joinName } from "@/utils";
import useApiVersionAtLeast from "@/devTools/editor/hooks/useApiVersionAtLeast";

// Empty value for text fields for the Formik state
const EMPTY_TEXT_VALUE = "";

function getDefaultArrayItem(schema: Schema): unknown {
  // TODO: handle enum and const

  if (schema.default) {
    return schema.default;
  }

  if (textPredicate(schema)) {
    return EMPTY_TEXT_VALUE;
  }

  if (schema.type === "object") {
    return defaultBlockConfig(schema);
  }

  if (findOneOf(schema, booleanPredicate)) {
    return false;
  }

  if (findOneOf(schema, textPredicate)) {
    return EMPTY_TEXT_VALUE;
  }

  return null;
}

const ArrayWidget: React.FC<SchemaFieldProps> = ({ schema, name }) => {
  const [field] = useField<UnknownObject[]>(name);

  if (Array.isArray(schema.items)) {
    throw new TypeError("Support for arrays of mixed types is not implemented");
  }

  if (typeof schema.items === "boolean") {
    throw new TypeError("Schema required for items");
  }

  const schemaItems = schema.items ?? { additionalProperties: true };

  const apiVersionAtLeastV3 = useApiVersionAtLeast("v3");
  // Show explicit remove button before v3
  const showRemove = !apiVersionAtLeastV3;

  return (
    <FieldArray name={name}>
      {({ handleRemove, push }) => (
        <>
          <ul className="list-group">
            {(field.value ?? []).map((item: unknown, index: number) => (
              <li className="list-group-item pb-0" key={index}>
                <SchemaField
                  key={index}
                  name={joinName(name, String(index))}
                  schema={schemaItems}
                  hideLabel
                  isArrayItem
                />
                {showRemove && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleRemove(index)}
                  >
                    Remove Item
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Button
            onClick={() => {
              push(getDefaultArrayItem(schemaItems));
            }}
          >
            Add Item
          </Button>
        </>
      )}
    </FieldArray>
  );
};

export default ArrayWidget;
