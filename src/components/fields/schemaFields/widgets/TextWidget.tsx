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
  type MutableRefObject,
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
import fitTextarea from "fit-textarea";
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
import { type Schema } from "@/types/schemaTypes";
import { type TemplateEngine } from "@/types/runtimeTypes";
import { isTemplateExpression } from "@/utils/expressionUtils";
import { trimEndOnce } from "@/utils/stringUtils";

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

// Regex Breakdown
//   -^: Assert the start of the string.
//   -@: Check for a @ character at the beginning of the string.
//   -(?!\d): Ensure the first character of the identifier is not a digit.
//   -([\w$]+): Capture the initial identifier, which can consist of letters, digits, underscores, or dollar signs.
//   -((\.[\w$]+)|(\[(\d+|"[^"]+")\]))*: Match any number of properties or array indices, separated by periods or enclosed in square brackets.\.[\w$]+: A property preceded by a period, consisting of letters, digits, underscores, or dollar signs.
//   -\[(\d+|"[^"]+")\]: Either an array index consisting of one or more digits, or a property name wrapped in double quotes and containing any characters except double quotes, both enclosed in square brackets.
//   -$: Assert the end of the string.
const objectPathRegex =
  // eslint-disable-next-line security/detect-unsafe-regex -- risky for long strings, but ok for var names
  /^@(?!\d)([\w$]+)((\.[\w$]+)|(\[(\d+|"[^"]+"|'[^']+')]))*$/;

// Regex to help detect if the user is typing a bracket expression on the end of a variable
// eslint-disable-next-line security/detect-unsafe-regex -- risky for long strings, but ok for var names
const unfinishedBracketExpressionRegex = /^(?<base>@.*)\[("[^"]*"?|\d*)?$/;

/**
 * Return true if the value is a valid variable expression
 */
export function isVarValue(value: string): boolean {
  return objectPathRegex.test(value);
}

/**
 * Returns true if the value is a valid variable expression or var-like expression while the user is typing
 */
export function isVarLike(value: string): boolean {
  if (
    isVarValue(value) ||
    // User-just started typing a variable
    value === "@" ||
    // User is starting to access a sub property.
    isVarValue(trimEndOnce(value, ".")) ||
    // User is starting to access an array index, or property with whitespace.
    isVarValue(trimEndOnce(value, "["))
  ) {
    return true;
  }

  const match = unfinishedBracketExpressionRegex.exec(value);
  return match != null && isVarValue(match.groups.base);
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
  const [{ value, ...restInputProps }, , { setValue }] = useField(name);

  const { allowExpressions: allowExpressionsContext } =
    useContext(FieldRuntimeContext);
  const allowExpressions = allowExpressionsContext && !isKeyStringField(schema);

  const defaultTextAreaRef = useRef<HTMLTextAreaElement>();
  const textAreaRef: MutableRefObject<HTMLTextAreaElement> =
    (inputRef as MutableRefObject<HTMLTextAreaElement>) ?? defaultTextAreaRef;

  useEffect(() => {
    if (textAreaRef.current) {
      fitTextarea.watch(textAreaRef.current);
    }
  }, [textAreaRef]);

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
        current.selectionStart = current.textLength;
        current.selectionEnd = current.textLength;
      }, 150);
    }
  }, [textAreaRef, focusInput]);

  const supportsTemplates = useMemo(
    () => schemaSupportsTemplates(schema),
    [schema]
  );

  const undo = useUndo(value, setValue);

  const keyDownHandler: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "z") {
      undo();
    }
  };

  const onChangeForTemplate = useCallback(
    (templateEngine: TemplateEngine) => {
      const onChange: React.ChangeEventHandler<HTMLInputElement> = ({
        target,
      }) => {
        const nextValue = target.value;
        // Automatically switch to var if user types "@" in the input
        if (
          templateEngine !== "var" &&
          (isVarValue(nextValue) || nextValue === "@")
        ) {
          setValue(makeVariableExpression(nextValue));
        } else if (
          // Automatically switch from var to text if the user starts typing text
          templateEngine === "var" &&
          supportsTemplates &&
          !isVarLike(nextValue)
        ) {
          // If the user is typing whitespace, automatically wrap in mustache braces
          const trimmed = trim(nextValue);
          const templateValue = isVarValue(trimmed)
            ? nextValue.replace(trimmed, `{{${trimmed}}}`)
            : nextValue;
          setValue(makeTemplateExpression("nunjucks", templateValue));
        } else {
          setValue(makeTemplateExpression(templateEngine, nextValue));
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
    const onChange: React.ChangeEventHandler<HTMLInputElement> =
      allowExpressions
        ? onChangeForTemplate("nunjucks")
        : (event) => {
            setValue(event.target.value);
          };

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
    <Form.Control
      as="textarea"
      rows="1"
      {...restInputProps}
      {...formControlProps}
      value={fieldInputValue}
      onChange={fieldOnChange}
      ref={textAreaRef}
      onKeyDown={keyDownHandler}
    />
  );
};

export default TextWidget;
