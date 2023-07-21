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
import { type SchemaFieldProps } from "@/components/fields/schemaFields/propTypes";
import { useField } from "formik";
import SelectWidget, {
  type Option,
  type SelectLike,
} from "@/components/form/widgets/SelectWidget";
import { type UUID } from "@/types/stringTypes";
import { type OptionProps, type ValueContainerProps } from "react-select";
import { Button } from "react-bootstrap";
import styles from "./SchemaButtonVariantWidget.module.scss";
import cx from "classnames";
import { type SingleValueProps } from "react-select/dist/declarations/src/components/SingleValue";

interface OptionValue {
  value: string;
  label: string;
}

const OptionComponent = ({
  innerProps,
  innerRef,
  data,
  isSelected,
}: OptionProps<OptionValue>) => (
  <div
    ref={innerRef}
    {...innerProps}
    className={cx(styles.optionContainer, { [styles.active]: isSelected })}
  >
    <Button
      data-testid="variant-option"
      type={null}
      variant={data.value}
      size="sm"
      className={styles.exampleButton}
    >
      {data.label}
    </Button>
  </div>
);

const ValueComponent = ({ data }: SingleValueProps<OptionValue>) => (
  <Button
    data-testid="selected-variant"
    type={null}
    variant={data.value}
    size="sm"
    className={styles.exampleButton}
  >
    {data.label}
  </Button>
);

const ContainerComponent = ({
  innerProps,
  children,
}: ValueContainerProps<OptionValue>) => (
  <div {...innerProps} className={styles.selectContainer}>
    {children}
  </div>
);

const SchemaButtonVariantWidget: React.FunctionComponent<SchemaFieldProps> = ({
  name,
  schema,
  uiSchema = {},
}) => {
  const [{ value }, , { setValue }] = useField(name);
  const { isSearchable, isClearable } = uiSchema;
  const { enum: options } = schema;

  return (
    <div className="mt-2" data-testid="select-container">
      <SelectWidget<OptionValue>
        name={name}
        options={options as Option[]}
        value={value}
        isSearchable={isSearchable}
        isClearable={isClearable}
        onChange={(event: React.ChangeEvent<SelectLike<Option<UUID>>>) => {
          setValue(event.target.value);
        }}
        components={{
          Option: OptionComponent,
          SingleValue: ValueComponent,
          ValueContainer: ContainerComponent,
        }}
      />
    </div>
  );
};

export default SchemaButtonVariantWidget;
