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

import React, { useCallback, useMemo, useState } from "react";
import Select, { type Options } from "react-select";
import { type SchemaFieldProps } from "@/components/fields/schemaFields/propTypes";
import { isEmpty, sortBy, uniq } from "lodash";
import { useField } from "formik";
import Creatable from "react-select/creatable";
import { isExpression } from "@/runtime/mapArgs";

type StringOption = {
  value: string;
};
type StringOptionsType = Options<StringOption>;

const SchemaSelectWidget: React.VFC<SchemaFieldProps> = ({ name, schema }) => {
  const [created, setCreated] = useState([]);
  const [{ value: fieldValue }, , { setValue }] = useField(name);

  // Need to handle expressions because this field could be toggled to "var"
  // and the Widget won't change until the input mode can be inferred again
  // from the new value.
  const value = isExpression(fieldValue) ? fieldValue.__value__ : fieldValue;

  const [creatable, options]: [boolean, StringOptionsType] = useMemo(() => {
    const values = schema.examples ?? schema.enum;
    const options =
      schema.type === "string" && Array.isArray(values)
        ? sortBy(
            uniq([...created, ...values, value].filter((x) => x != null))
          ).map((value) => ({
            value,
            label: value,
          }))
        : [];
    return [schema?.enum == null, options];
  }, [schema.examples, schema.enum, created, value, schema.type]);

  const selectedValue = options.find((x) => x.value === value) ?? {
    value: null,
  };

  const selectOnChange = useCallback(
    (option: StringOption) => {
      setValue(option?.value ?? null);
    },
    [setValue]
  );

  if (isEmpty(options)) {
    console.warn("No select options found", { schema, value });
  }

  return creatable ? (
    <Creatable
      inputId={name}
      isClearable
      options={options}
      onCreateOption={(value) => {
        setValue(value);
        setCreated(uniq([...created, value]));
      }}
      value={selectedValue}
      onChange={selectOnChange}
    />
  ) : (
    <Select
      inputId={name}
      isClearable
      options={options}
      value={selectedValue}
      onChange={selectOnChange}
    />
  );
};

export default SchemaSelectWidget;
