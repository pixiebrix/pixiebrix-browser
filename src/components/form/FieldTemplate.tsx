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

import React, { ReactNode, useContext } from "react";
import {
  Col,
  Form as BootstrapForm,
  FormControlProps,
  Row,
} from "react-bootstrap";
import { Except } from "type-fest";
import SwitchButtonWidget from "@/components/form/widgets/switchButton/SwitchButtonWidget";
import styles from "./FieldTemplate.module.scss";
import FormTheme from "@/components/form/FormTheme";
import { getErrorMessage } from "@/errors";
import { useAsyncEffect } from "use-async-effect";
import { sleep } from "@/utils";

export type FieldProps<
  As extends React.ElementType = React.ElementType
> = FormControlProps &
  React.ComponentProps<As> & {
    name: string;
    layout?: "horizontal" | "vertical" | "switch";
    label?: ReactNode;
    description?: ReactNode;
    error?: string;
    touched?: boolean;

    /**
     * This value is regarded as absence of value, unset property.
     * It will be passed to the UI input control when the value is undefined.
     */
    blankValue?: unknown;

    /**
     * This is the default.
     * When value is not set an onChange event will be triggered with the defaultValue.
     * Note: this may mark you field as dirty.
     */
    defaultValue?: unknown;
  };

type WidgetElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
export type CustomFieldWidgetProps<
  TValue = string | string[] | number,
  TInputElement = WidgetElement
> = {
  id?: string;
  name: string;
  disabled?: boolean;
  value: TValue;
  onChange: React.ChangeEventHandler<TInputElement>;
};
export type CustomFieldWidget<
  TValue = string | string[] | number,
  TInputElement = WidgetElement,
  TFieldWidgetProps extends CustomFieldWidgetProps<
    TValue,
    TInputElement
  > = CustomFieldWidgetProps<TValue, TInputElement>
> = React.ComponentType<TFieldWidgetProps>;

type FieldRenderProps = Except<FieldProps, "layout">;

const RenderedField: React.FC<FieldProps> = ({
  name,
  layout,
  label,
  description,
  error,
  touched,
  value,
  children,
  blankValue = "",
  as: AsControl,
  defaultValue,
  onChange,
  ...restFieldProps
}) => {
  const isInvalid = touched && Boolean(error);

  // Setting default value if needed
  useAsyncEffect(async (isMounted) => {
    await sleep(50);
    if (!isMounted) {
      return;
    }

    if (
      typeof defaultValue !== "undefined" &&
      (typeof value === "undefined" || value === null || value === blankValue)
    ) {
      onChange({ target: { value: defaultValue, name } });
    }
  }, []);

  // Prevent undefined values to keep the HTML `input` tag from becoming uncontrolled
  const nonUndefinedValue = typeof value === "undefined" ? blankValue : value;

  // Note on `controlId` and Bootstrap FormGroup.
  // If we set `controlId` on the Bootstrap FormGroup, we must not set `id` on `FormLabel` and `FormControl`.
  // This makes it impossible to use a FormControl as a CustomWidget,
  // because it gets both `controlId` from Group and `id` from props of `AsControl`.
  // See their logic at https://github.com/react-bootstrap/react-bootstrap/blob/v1.6.4/src/FormControl.tsx#L179:L182
  // The most simple solution is to manually set `htmlFor` on the Label and `id` on the Control.
  const controlId = name;

  const formControl =
    typeof AsControl === "undefined" || typeof AsControl === "string" ? (
      <BootstrapForm.Control
        id={controlId}
        name={name}
        isInvalid={isInvalid}
        value={nonUndefinedValue}
        as={AsControl}
        onChange={onChange}
        {...restFieldProps}
      >
        {children}
      </BootstrapForm.Control>
    ) : (
      <AsControl
        id={controlId}
        name={name}
        isInvalid={isInvalid}
        value={nonUndefinedValue}
        onChange={onChange}
        {...restFieldProps}
      >
        {children}
      </AsControl>
    );
  return layout === "vertical" ? (
    <BootstrapForm.Group className={styles.verticalFormGroup}>
      {label && (
        <BootstrapForm.Label
          className={styles.verticalFormLabel}
          htmlFor={controlId}
        >
          {label}
        </BootstrapForm.Label>
      )}
      {formControl}
      {description && (
        <BootstrapForm.Text className="text-muted">
          {description}
        </BootstrapForm.Text>
      )}
      {isInvalid && (
        <div className={styles.invalidMessage}>{getErrorMessage(error)}</div>
      )}
    </BootstrapForm.Group>
  ) : (
    <BootstrapForm.Group as={Row} className={styles.horizontalFormGroup}>
      {label && (
        <BootstrapForm.Label
          column
          lg="3"
          className={styles.horizontalLabel}
          htmlFor={controlId}
        >
          {label}
        </BootstrapForm.Label>
      )}
      <Col lg={label ? "9" : "12"}>
        {formControl}
        {description && (
          <BootstrapForm.Text className="text-muted">
            {description}
          </BootstrapForm.Text>
        )}
        {isInvalid && (
          <div className={styles.invalidMessage}>{getErrorMessage(error)}</div>
        )}
      </Col>
    </BootstrapForm.Group>
  );
};

const RenderedSwitch: React.FC<FieldRenderProps> = ({
  name,
  label,
  onChange,
  value,
}) => (
  <BootstrapForm.Group as={Row} controlId={name}>
    <Col sm="3">
      <SwitchButtonWidget name={name} onChange={onChange} value={value} />
    </Col>
    <Col sm="9" as="label" htmlFor={name}>
      {label}
    </Col>
  </BootstrapForm.Group>
);

const FieldTemplate: React.FC<FieldProps> = ({ layout, ...restProps }) => {
  const theme = useContext(FormTheme);

  switch (layout ?? theme.layout) {
    case "switch":
      return <RenderedSwitch {...restProps} />;
    default:
      return <RenderedField layout={layout} {...restProps} />;
  }
};

export default FieldTemplate;
