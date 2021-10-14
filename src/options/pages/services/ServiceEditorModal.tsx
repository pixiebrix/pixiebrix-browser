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

import optionsRegistry from "@/components/fields/optionsRegistry";
import React, { useCallback, useMemo } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import AsyncButton from "@/components/AsyncButton";
import { IService, RawServiceConfiguration, UUID } from "@/core";
import { Formik, FormikHelpers } from "formik";
import { dereference } from "@/validators/generic";
import { cloneDeep, truncate } from "lodash";
import { useAsyncState } from "@/hooks/common";
import genericOptionsFactory from "@/components/fields/schemaFields/genericOptionsFactory";
import { buildYup } from "schema-to-yup";
import * as Yup from "yup";
import { reportError } from "@/telemetry/logging";
import { useTitle } from "@/hooks/title";
import FormTheme, { ThemeProps } from "@/components/form/FormTheme";
import ConnectedFieldTemplate from "@/components/form/ConnectedFieldTemplate";
import FieldTemplate from "@/components/form/FieldTemplate";

interface OwnProps {
  configuration: RawServiceConfiguration;
  service: IService;
  onClose: () => void;
  onDelete?: (id: UUID) => void;
  onSave: (config: RawServiceConfiguration) => Promise<void>;
}

const formTheme: ThemeProps = {
  layout: "vertical",
};

const ServiceEditorModal: React.FunctionComponent<OwnProps> = ({
  configuration: originalConfiguration,
  service,
  onClose,
  onDelete,
  onSave,
}) => {
  useTitle(`Configure ${truncate(service.name, { length: 15 })}`);

  const handleSave = useCallback(
    async (
      values: RawServiceConfiguration,
      actions: FormikHelpers<RawServiceConfiguration>
    ) => {
      actions.setSubmitting(true);
      await onSave(values);
    },
    [onSave]
  );

  const Editor = useMemo(() => {
    if (optionsRegistry.has(service.id)) {
      return optionsRegistry.get(service.id);
    }

    return genericOptionsFactory(service.schema);
  }, [service]);

  const schemaPromise = useMemo(
    async () =>
      dereference({
        type: "object",
        properties: {
          organization: {
            type: "string",
          },
          label: {
            type: "string",
          },
          // $RefParse mutates the schema
          config: cloneDeep(service.schema),
        },
      }),
    [service.schema]
  );

  const [schema] = useAsyncState(schemaPromise);

  const validationSchema = useMemo(() => {
    if (!schema) {
      return Yup.object();
    }

    try {
      return buildYup(schema, {});
    } catch (error: unknown) {
      console.error("Error building Yup validator from JSON Schema");
      reportError(error);
      return Yup.object();
    }
  }, [schema]);

  if (!schema) {
    return null;
  }

  return (
    <Modal
      style={{ zIndex: 999 }}
      show
      onHide={onClose}
      backdrop="static"
      keyboard={false}
    >
      <Modal.Header closeButton>
        <Modal.Title>Configure Private Integration: {service.name}</Modal.Title>
      </Modal.Header>

      <Formik
        onSubmit={handleSave}
        initialValues={originalConfiguration}
        validationSchema={validationSchema}
      >
        {({ handleSubmit, isValid, isSubmitting }) => (
          <Form noValidate onSubmit={handleSubmit}>
            <Modal.Body>
              <FormTheme.Provider value={formTheme}>
                <ConnectedFieldTemplate
                  name="label"
                  label="Label"
                  description="A label to help identify this integration"
                  blankValue=""
                />
                <FieldTemplate
                  label="Integration"
                  name="service"
                  type="text"
                  plaintext
                  readOnly
                  value={service.id}
                />
                <Editor name="config" />
              </FormTheme.Provider>
            </Modal.Body>
            <Modal.Footer>
              <div className="d-flex w-100">
                <div className="flex-grow-1">
                  {onDelete && (
                    <AsyncButton
                      variant="outline-danger"
                      onClick={() => {
                        onDelete(originalConfiguration.id);
                      }}
                    >
                      Delete
                    </AsyncButton>
                  )}
                </div>
                <div>
                  <Button variant="default" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={isSubmitting || !isValid}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </Modal.Footer>
          </Form>
        )}
      </Formik>
    </Modal>
  );
};

export default ServiceEditorModal;
