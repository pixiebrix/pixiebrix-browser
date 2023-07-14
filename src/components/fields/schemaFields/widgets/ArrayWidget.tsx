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

import { type SchemaFieldProps } from "@/components/fields/schemaFields/propTypes";
import { FieldArray, useField } from "formik";
import { Button } from "react-bootstrap";
import React, { useMemo } from "react";
import { type Schema } from "@/types/schemaTypes";
import {
  booleanPredicate,
  findOneOf,
  textPredicate,
} from "@/components/fields/schemaFields/schemaUtils";
import { type UnknownObject } from "@/types/objectTypes";
import { defaultBlockConfig } from "@/bricks/util";
import SchemaField from "@/components/fields/schemaFields/SchemaField";
import { joinName } from "@/utils";
import styles from "./ArrayWidget.module.scss";

type ArrayWidgetProps = SchemaFieldProps & {
  addButtonCaption?: string;
};

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

const ArrayWidget: React.VFC<ArrayWidgetProps> = ({
  schema,
  validationSchema,
  name,
  addButtonCaption = "Add Item",
}) => {
  const [field] = useField<UnknownObject[]>(name);

  if (Array.isArray(schema.items)) {
    throw new TypeError("Support for arrays of mixed types is not implemented");
  }

  if (typeof schema.items === "boolean") {
    throw new TypeError("Schema required for items");
  }

  const schemaItems = useMemo<Schema>(
    // Cast is okay here since we've already checked for array/boolean types
    () => (schema.items as Schema) ?? { additionalProperties: true },
    [schema.items]
  );

  return (
    <FieldArray name={name}>
      {({ push }) => (
        <>
          <ul className="list-group mb-2">
            {(field.value ?? []).map((item: unknown, index: number) => (
              <li className="list-group-item py-1" key={index}>
                <SchemaField
                  key={index}
                  name={joinName(name, String(index))}
                  schema={schemaItems}
                  validationSchema={validationSchema}
                  hideLabel
                  isArrayItem
                />
              </li>
            ))}
          </ul>
          <Button
            variant="link"
            className={styles.addButton}
            onClick={() => {
              push(getDefaultArrayItem(schemaItems));
            }}
          >
            {addButtonCaption}
          </Button>
        </>
      )}
    </FieldArray>
  );
};

export default ArrayWidget;
