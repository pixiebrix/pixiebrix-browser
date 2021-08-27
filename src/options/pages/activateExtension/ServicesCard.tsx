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
import { AuthOption } from "@/auth/authTypes";
import { useField } from "formik";
import { ServiceDependency } from "@/core";
import useFetch from "@/hooks/useFetch";
import { ServiceDefinition } from "@/types/definitions";
import { PIXIEBRIX_SERVICE_ID } from "@/services/constants";
import { Card, Table } from "react-bootstrap";
import ServiceDescriptor from "@/options/pages/marketplace/ServiceDescriptor";
import AuthWidget from "@/options/pages/marketplace/AuthWidget";

const ServicesCard: React.FunctionComponent<{ authOptions: AuthOption[] }> = ({
  authOptions,
}) => {
  const [field] = useField<ServiceDependency[]>("services");

  const { data: serviceConfigs } = useFetch<ServiceDefinition[]>(
    "/api/services/"
  );

  const values = field.value.map((dependency, index) => ({
    dependency,
    valueIndex: index,
  }));

  const configurable = values.filter(
    ({ dependency }) => dependency.id !== PIXIEBRIX_SERVICE_ID
  );

  if (configurable.length === 0) {
    return null;
  }

  return (
    <Card className="mb-3">
      <Card.Header>Configure Services</Card.Header>
      <Table>
        <thead>
          <tr>
            <th style={{ minWidth: "200px" }}>Integration</th>
            <th className="w-100">Configuration</th>
          </tr>
        </thead>
        <tbody>
          {configurable.map(({ dependency, valueIndex }) => (
            <tr key={`dependency.outputKey-${valueIndex}`}>
              <td>
                <ServiceDescriptor
                  serviceId={dependency.id}
                  serviceConfigs={serviceConfigs}
                />
              </td>
              <td>
                <AuthWidget
                  authOptions={authOptions}
                  serviceId={dependency.id}
                  name={[field.name, valueIndex, "config"].join(".")}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
};

export default ServicesCard;
