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

import styles from "./Form.module.scss";

import React, { type ReactElement } from "react";
// eslint-disable-next-line no-restricted-imports -- TODO: Fix over time
import { Alert, Button, Form as BootstrapForm } from "react-bootstrap";
// eslint-disable-next-line no-restricted-imports -- TODO: Fix over time
import { Formik, type FormikHelpers, type FormikValues } from "formik";
import type * as yup from "yup";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { FormErrorContext } from "@/components/form/FormErrorContext";

export type OnSubmit<TValues = FormikValues> = (
  values: TValues,
  formikHelpers: FormikHelpers<TValues>
) => void | Promise<unknown>;

export type RenderBody = (state: {
  isValid: boolean;
  values: FormikValues;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- type from Formik
  setFieldValue: (field: string, value: any, shouldValidate?: boolean) => void;
  isSubmitting: boolean;
}) => ReactElement;

export type RenderSubmit = (state: {
  isSubmitting: boolean;
  isValid: boolean;
  values: FormikValues;
}) => ReactElement;

type RenderStatus = (state: { status: string }) => ReactElement;

type FormProps = {
  /**
   * The starting formik field values for the form
   */
  initialValues: FormikValues;

  /**
   * Should the form be validated on component mount?
   */
  validateOnMount?: boolean;

  /**
   * (from Formik): Should Formik reset the form when new initialValues change?
   */
  enableReinitialize?: boolean;

  /**
   * The render function for the body of the form
   */
  renderBody?: RenderBody;

  /**
   * The render function for the submit button (and any other co-located buttons)
   */
  renderSubmit?: RenderSubmit;

  /**
   * The render function for the top-level form status message
   *
   * Note: This currently defaults to an "error" style layout
   */
  renderStatus?: RenderStatus;

  /**
   * The submission handler for the form
   */
  onSubmit: OnSubmit;

  /**
   * The yup validation schema for the form
   */
  validationSchema?: yup.AnyObjectSchema;

  /**
   * Use the analysis annotations instead of formik to get the errors
   * Note: validationSchema will be ignored if this is true
   */
  enableAnalysisFieldErrors?: boolean;

  /**
   * Should we show errors on fields that are not marked touched yet?
   */
  showUntouchedErrors?: boolean;

  /**
   * Should we show actions for errors and warnings?
   */
  showFieldActions?: boolean;

  /**
   * CSS class name to apply to the form element
   */
  className?: string;
};

const defaultRenderSubmit: RenderSubmit = ({ isSubmitting, isValid }) => (
  <Button type="submit" disabled={!isValid || isSubmitting}>
    Submit
  </Button>
);

const defaultRenderStatus: RenderStatus = ({ status }) => (
  <Alert variant="danger" className={styles.status}>
    <FontAwesomeIcon icon={faExclamationTriangle} /> {status}
  </Alert>
);

const Form: React.FC<FormProps> = ({
  // Default to {} to be defensive against callers that pass through null/undefined form state when uninitialized
  initialValues = {},
  validateOnMount,
  enableReinitialize,
  children,
  renderBody,
  renderSubmit = defaultRenderSubmit,
  renderStatus = defaultRenderStatus,
  onSubmit,
  validationSchema,
  enableAnalysisFieldErrors,
  showUntouchedErrors,
  showFieldActions,
  className,
}) => (
  <FormErrorContext.Provider
    value={{
      shouldUseAnalysis: enableAnalysisFieldErrors,
      showUntouchedErrors,
      showFieldActions,
    }}
  >
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      validateOnMount={validateOnMount}
      enableReinitialize={enableReinitialize}
      onSubmit={onSubmit}
    >
      {({
        handleSubmit,
        isSubmitting,
        isValid,
        values,
        status,
        setFieldValue,
      }) => (
        <BootstrapForm noValidate onSubmit={handleSubmit} className={className}>
          {status && renderStatus({ status })}
          {renderBody
            ? renderBody({ isValid, values, setFieldValue, isSubmitting })
            : children}
          {renderSubmit({ isSubmitting, isValid, values })}
        </BootstrapForm>
      )}
    </Formik>
  </FormErrorContext.Provider>
);

export default Form;
