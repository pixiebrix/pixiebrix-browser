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

import React, { useMemo } from "react";
import { Card, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import { RecipeDefinition, ServiceDefinition } from "@/types/definitions";
import { useSelectedExtensions } from "@/options/pages/marketplace/ConfigureBody";
import { faCloud, faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import useFetch from "@/hooks/useFetch";
import { PIXIEBRIX_SERVICE_ID } from "@/services/constants";
import AuthWidget from "@/options/pages/marketplace/AuthWidget";
import ServiceDescriptor from "@/options/pages/marketplace/ServiceDescriptor";
import { useField } from "formik";
import { ServiceAuthPair } from "@/core";
import { useAuthOptions } from "@/hooks/auth";

interface OwnProps {
  blueprint: RecipeDefinition;
}

const ServicesBody: React.FunctionComponent<OwnProps> = ({ blueprint }) => {
  const [authOptions, refreshAuthOptions] = useAuthOptions();

  const [field] = useField<ServiceAuthPair[]>("services");

  const selected = useSelectedExtensions(blueprint.extensionPoints);

  const { data: serviceConfigs } = useFetch<ServiceDefinition[]>(
    "/api/services/"
  );

  const visibleServiceIds = useMemo(
    // The PixieBrix service gets automatically configured, so don't need to show it. If the PixieBrix service is
    // the only service, the wizard won't render the ServicesBody component at all
    () =>
      new Set(
        selected
          .flatMap((x) => Object.values(x.services ?? {}))
          .filter((serviceId) => serviceId !== PIXIEBRIX_SERVICE_ID)
      ),
    [selected]
  );

  return (
    <>
      <Card.Body className="p-3">
        <Card.Title>Select Integrations</Card.Title>
        <p>
          Integrations tell PixieBrix how to connect to the other applications
          and integrations you use
        </p>
        <p className="text-info">
          <FontAwesomeIcon icon={faInfoCircle} /> You can configure integrations
          at any time on the{" "}
          <Link to="/services">
            <u>
              <FontAwesomeIcon icon={faCloud} />
              {"  "}Integrations page
            </u>
          </Link>
        </p>
      </Card.Body>
      <Table>
        <thead>
          <tr>
            <th style={{ minWidth: "200px" }}>Integration</th>
            <th className="w-100">Configuration</th>
          </tr>
        </thead>
        <tbody>
          {field.value.map(({ id: serviceId }, index) =>
            // Can't filter using `filter` because the index used in the field name for AuthWidget needs to be
            // consistent with the index in field.value
            visibleServiceIds.has(serviceId) ? (
              <tr key={serviceId}>
                <td>
                  <ServiceDescriptor
                    serviceId={serviceId}
                    serviceConfigs={serviceConfigs}
                  />
                </td>
                <td>
                  <AuthWidget
                    authOptions={authOptions}
                    serviceId={serviceId}
                    name={[field.name, index, "config"].join(".")}
                    onRefresh={refreshAuthOptions}
                  />
                </td>
              </tr>
            ) : null
          )}
          {visibleServiceIds.size === 0 && (
            <tr>
              <td colSpan={2}>No services to configure</td>
            </tr>
          )}
        </tbody>
      </Table>
    </>
  );
};

export default ServicesBody;
