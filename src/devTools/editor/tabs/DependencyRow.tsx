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

import React from "react";
import { Button, Form } from "react-bootstrap";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ServiceDependency } from "@/core";
import { Field, FieldInputProps } from "formik";
import ServiceAuthSelector from "@/components/ServiceAuthSelector";
import { AuthOption } from "@/auth/authTypes";

const DependencyRow: React.FunctionComponent<{
  field: FieldInputProps<unknown>;
  authOptions: AuthOption[];
  dependency: ServiceDependency;
  index: number;
  remove: (x: number) => void;
}> = ({ field, authOptions, index, remove, dependency }) => (
  <tr>
    <td style={{ width: 250 }}>
      <Field name={`${field.name}.${index}.outputKey`}>
        {/* @ts-expect-error not sure what's going on with the type definition for this */}
        {({ field, meta }) => (
          <Form.Group>
            <Form.Control
              {...field}
              size="default"
              isInvalid={Boolean(meta.error)}
            />
            {meta.touched && meta.error && (
              <Form.Control.Feedback type="invalid">
                {meta.error}
              </Form.Control.Feedback>
            )}
          </Form.Group>
        )}
      </Field>
    </td>
    <td>
      <Form.Group>
        {/* TODO: indicate if the service no longer exists */}
        <input
          type="hidden"
          name={`${field.name}.${index}.id`}
          value={dependency.id}
        />
        <code>{dependency.id}</code>
      </Form.Group>
    </td>
    <td style={{ width: 350 }}>
      <ServiceAuthSelector
        name={`${field.name}.${index}.config`}
        serviceId={dependency.id}
        authOptions={authOptions}
      />
    </td>
    <td>
      <Form.Group>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            remove(index);
          }}
        >
          <FontAwesomeIcon icon={faTrash} /> Remove
        </Button>
      </Form.Group>
    </td>
  </tr>
);

export default DependencyRow;
