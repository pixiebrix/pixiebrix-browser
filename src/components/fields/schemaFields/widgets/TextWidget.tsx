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

import React, {
  type KeyboardEventHandler,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { type SchemaFieldProps } from "@/components/fields/schemaFields/propTypes";
import { useField } from "formik";
// eslint-disable-next-line no-restricted-imports -- TODO: Fix over time
import { Form, type FormControlProps } from "react-bootstrap";
import { type Schema, type TemplateEngine } from "@/core";
import { isTemplateExpression } from "@/runtime/mapArgs";
import { trim } from "lodash";
import FieldRuntimeContext from "@/components/fields/schemaFields/FieldRuntimeContext";
import { isMustacheOnly } from "@/components/fields/fieldUtils";
import { getToggleOptions } from "@/components/fields/schemaFields/getToggleOptions";
import useUndo from "@/hooks/useUndo";
import { isKeyStringField } from "@/components/fields/schemaFields/fieldTypeCheckers";
import {
  makeTemplateExpression,
  makeVariableExpression,
} from "@/runtime/expressionCreators";
import TemplateEditor from "./templateEditor/TemplateEditor";

function schemaSupportsTemplates(schema: Schema): boolean {
  const options = getToggleOptions({
    fieldSchema: schema,
    isRequired: false,
    customToggleModes: [],
    isObjectProperty: false,
    isArrayItem: false,
    allowExpressions: true,
  });
  return options.some(
    (option) => option.value === "string" && option.label === "Text"
  );
}

function isVarValue(value: string): boolean {
  return value.startsWith("@") && !value.includes(" ");
}

const TextWidget: React.VFC<SchemaFieldProps & FormControlProps> = ({
  name,
  schema,
  validationSchema,
  isRequired,
  label,
  description,
  uiSchema,
  hideLabel,
  isObjectProperty,
  isArrayItem,
  focusInput,
  inputRef,
  ...formControlProps
}) => {
  const [{ value }, , { setValue }] = useField(name);

  const { allowExpressions: allowExpressionsContext } =
    useContext(FieldRuntimeContext);
  const allowExpressions = allowExpressionsContext && !isKeyStringField(schema);

  const textAreaRef = useRef<HTMLTextAreaElement>();

  useEffect(() => {
    // Sync the ref values
    if (inputRef) {
      inputRef.current = textAreaRef.current;
    }
  }, [textAreaRef.current]);

  useEffect(() => {
    if (focusInput) {
      // We need to use a setTimeout here in order to override the default
      // behavior of Bootstrap DropdownButton in the field type toggle.
      // The standard w3c behavior of a dropdown/select is that the button
      // is re-focused after making an option selection. Since our dropdown
      // is tightly coupled with the field input itself, we want to focus the
      // input on selection instead, so that users do not need to click into
      // the field every time after making a toggle selection. Unfortunately,
      // the DropdownButton grabs focus back after it runs all the
      // "on select option" handlers (and thus, after this field is rendered),
      // so we need to wait a bit to make sure we can focus the input after
      // this happens.
      // See: https://github.com/react-bootstrap/react-bootstrap/issues/2553
      setTimeout(() => {
        const { current } = textAreaRef;
        if (!current) {
          return;
        }

        current.focus();
      }, 150);
    }
  }, [focusInput]);

  const supportsTemplates = useMemo(
    () => schemaSupportsTemplates(schema),
    [schema]
  );

  const onChangeForTemplate = useCallback(
    (templateEngine: TemplateEngine) => {
      const onChange = (changeValue: string) => {
        // Automatically switch to var if user types "@" in the input
        if (templateEngine !== "var" && isVarValue(changeValue)) {
          setValue(makeVariableExpression(changeValue));
        } else if (
          templateEngine === "var" &&
          supportsTemplates &&
          !isVarValue(changeValue)
        ) {
          const trimmed = trim(changeValue);
          const templateValue = isVarValue(trimmed)
            ? changeValue.replace(trimmed, `{{${trimmed}}}`)
            : changeValue;
          setValue(makeTemplateExpression("nunjucks", templateValue));
        } else {
          setValue(makeTemplateExpression(templateEngine, changeValue));
        }
      };

      return onChange;
    },
    [setValue, supportsTemplates]
  );

  const [fieldInputValue, fieldOnChange] = useMemo(() => {
    if (isTemplateExpression(value)) {
      // Convert mustache templates to nunjucks if possible, because the page editor only
      // supports nunjucks, and it doesn't show the template engine anywhere to the user anymore.
      const shouldChangeToNunjucks =
        value.__type__ === "mustache" && !isMustacheOnly(value.__value__);
      return [
        value.__value__,
        shouldChangeToNunjucks
          ? onChangeForTemplate("nunjucks")
          : onChangeForTemplate(value.__type__),
      ];
    }

    const fieldValue = typeof value === "string" ? value : "";
    const onChange = allowExpressions
      ? onChangeForTemplate("nunjucks")
      : setValue;

    return [fieldValue, onChange];
  }, [allowExpressions, onChangeForTemplate, setValue, value]);

  if (
    value !== null &&
    !isTemplateExpression(value) &&
    typeof value === "object"
  ) {
    console.warn("Cannot edit object/array as text", { schema, value });
    return <div>Cannot edit object value as text</div>;
  }

  return (
    <TemplateEditor
      value={fieldInputValue}
      onChange={fieldOnChange}
      ref={textAreaRef}
    />
  );
};

export default TextWidget;
