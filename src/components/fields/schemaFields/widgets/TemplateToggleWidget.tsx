/*
 * Copyright (C) 2022 PixieBrix, Inc.
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

import styles from "./TemplateToggleWidget.module.scss";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { FieldInputMode } from "@/components/fields/schemaFields/fieldInputMode";
import { Dropdown, DropdownButton } from "react-bootstrap";
import WidgetLoadingIndicator from "@/components/fields/schemaFields/widgets/WidgetLoadingIndicator";
import useToggleFormField from "@/pageEditor/hooks/useToggleFormField";
import { useField } from "formik";
import {
  InputModeOption,
  TemplateToggleWidgetProps,
} from "./templateToggleWidgetTypes";

export function getOptionForInputMode(
  options: InputModeOption[],
  inputMode: FieldInputMode
): InputModeOption | null {
  return options.find((option) => option.value === inputMode) ?? null;
}

/**
 * Show a field toggle that lets a user choose the type of data input, along with the chosen input
 *
 * @param inputModeOptions Options for types of inputs allowed for this field
 * @param setFieldDescription Setter to handle changing the field description based on which option is toggled
 * @param props SchemaFieldProps
 */
const TemplateToggleWidget: React.VFC<TemplateToggleWidgetProps> = ({
  inputModeOptions,
  setFieldDescription,
  defaultType,
  inputRef: inputRefProp, // Cut out from the rest of the props, not used
  ...schemaFieldProps
}) => {
  const [{ value }, , { setValue }] = useField(schemaFieldProps.name);
  const { inputMode, onOmitField } = useToggleFormField(
    schemaFieldProps.name,
    schemaFieldProps.schema
  );
  const inputRef = useRef<HTMLTextAreaElement>();
  const selectedOption = inputModeOptions.find((x) => x.value === inputMode);
  const Widget = selectedOption?.Widget ?? WidgetLoadingIndicator;
  const [focusInput, setFocusInput] = useState(false);

  useEffect(() => {
    setFocusInput(false);
    const option = getOptionForInputMode(inputModeOptions, inputMode);
    setFieldDescription(option?.description);
  }, [inputMode, inputModeOptions, setFieldDescription]);

  const onModeChange = useCallback(
    (newInputMode: FieldInputMode) => {
      if (newInputMode === inputMode) {
        // Don't execute anything on "re-select", we don't want to
        // overwrite the field with the default value again.
        return;
      }

      if (newInputMode === "omit") {
        onOmitField();
        return;
      }

      const { interpretValue } = getOptionForInputMode(
        inputModeOptions,
        newInputMode
      );

      // Already handled "omit" and returned above
      setValue(interpretValue(value));
      setFocusInput(true);
    },
    [inputMode, inputModeOptions, setValue, value, onOmitField]
  );

  const widgetProps = {
    ...schemaFieldProps,
    focusInput,
    inputRef,
  };
  if (inputMode === "omit") {
    widgetProps.onClick = () => {
      if (defaultType != null) {
        onModeChange(defaultType);
      } else if (inputModeOptions.some((option) => option.value === "string")) {
        onModeChange("string");
      } else if (inputModeOptions.some((option) => option.value === "number")) {
        onModeChange("number");
      } else if (inputModeOptions.some((option) => option.value === "var")) {
        onModeChange("var");
      }
    };
  }

  return (
    <div className={styles.root}>
      <div className={styles.field}>
        <Widget {...widgetProps} />
        {/* Commented out until the popup body is implemented
        <VarPopup
          inputMode={inputMode}
          inputElementRef={inputRef}
          value={value}
        /> */}
      </div>
      <DropdownButton
        title={
          <span className={styles.symbol}>{selectedOption?.symbol ?? ""}</span>
        }
        variant="link"
        disabled={inputModeOptions.length < 2}
        alignRight
        onSelect={onModeChange}
        className={styles.dropdown}
        data-testid={`toggle-${schemaFieldProps.name}`}
        data-test-selected={selectedOption?.label ?? ""}
      >
        {inputModeOptions.map((option) => (
          <Dropdown.Item
            key={option.value}
            eventKey={option.value}
            data-testid={option.value}
          >
            <span className={styles.symbol}>{option.symbol}</span>{" "}
            {option.label}
          </Dropdown.Item>
        ))}
      </DropdownButton>
    </div>
  );
};

export default React.memo(TemplateToggleWidget);
