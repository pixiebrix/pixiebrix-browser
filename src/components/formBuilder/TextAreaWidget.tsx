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
  type FocusEventHandler,
  type KeyboardEventHandler,
  useCallback,
  useContext,
} from "react";
import { type WidgetProps } from "@rjsf/core";
import { isNumber } from "lodash";
import { RjsfSubmitContext } from "@/bricks/renderers/CustomFormComponent";

const TextAreaWidget: React.FC<WidgetProps> = ({
  id,
  options,
  placeholder,
  value,
  required,
  disabled,
  readonly,
  onChange,
  onFocus,
  onBlur,
}) => {
  const { submitForm } = useContext(RjsfSubmitContext);

  const onKeyPress = useCallback<KeyboardEventHandler<HTMLTextAreaElement>>(
    async (event) => {
      if (options.submitOnEnter && event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        await submitForm();
      }
    },
    [options.submitOnEnter, submitForm]
  );

  const onFocusHandler = useCallback<FocusEventHandler<HTMLTextAreaElement>>(
    (event) => {
      onFocus(id, event.target.value);
    },
    [id, onFocus]
  );

  const onBlurHandler = useCallback<FocusEventHandler<HTMLTextAreaElement>>(
    (event) => {
      onBlur(id, event.target.value);
    },
    [id, onBlur]
  );

  // @see @rjsf/core/lib/components/widgets/TextareaWidget.js
  return (
    <textarea
      id={id}
      className="form-control"
      value={String(value ?? "")}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      readOnly={readonly}
      rows={isNumber(options.rows) ? options.rows : undefined}
      onKeyPress={onKeyPress}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      onFocus={onFocusHandler}
      onBlur={onBlurHandler}
    />
  );
};

export default TextAreaWidget;
