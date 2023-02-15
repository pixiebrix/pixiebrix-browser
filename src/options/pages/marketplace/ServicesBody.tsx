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

import styles from "./ServicesBody.module.scss";

import React, { useMemo } from "react";
import { Card } from "react-bootstrap";
import { type RecipeDefinition } from "@/types/definitions";
import { PIXIEBRIX_SERVICE_ID } from "@/services/constants";
import AuthWidget from "@/components/auth/AuthWidget";
import ServiceDescriptor from "@/options/pages/marketplace/ServiceDescriptor";
import { useField } from "formik";
import { type ServiceAuthPair } from "@/core";
import { useAuthOptions } from "@/hooks/auth";
import { useGetServicesQuery } from "@/services/api";
import { joinName } from "@/utils";
import ServiceFieldError from "@/options/components/ServiceFieldError";
import FieldAnnotationAlert from "@/components/annotationAlert/FieldAnnotationAlert";
import { AnnotationType } from "@/types";

interface OwnProps {
  blueprint: RecipeDefinition;
}

const ServicesBody: React.FunctionComponent<OwnProps> = ({ blueprint }) => {
  const [authOptions, refreshAuthOptions] = useAuthOptions();

  const [field, { error }] = useField<ServiceAuthPair[]>("services");

  const { data: serviceConfigs } = useGetServicesQuery();

  const visibleServiceIds = useMemo(
    // The PixieBrix service gets automatically configured, so don't need to show it. If the PixieBrix service is
    // the only service, the wizard won't render the ServicesBody component at all
    () =>
      new Set(
        blueprint.extensionPoints
          .flatMap((x) => Object.values(x.services ?? {}))
          .filter((serviceId) => serviceId !== PIXIEBRIX_SERVICE_ID)
      ),
    [blueprint.extensionPoints]
  );

  return (
    <>
      {typeof error === "string" && (
        <FieldAnnotationAlert message={error} type={AnnotationType.Error} />
      )}
      {field.value.map(
        ({ id: serviceId }, index) =>
          // Can't filter using `filter` because the index used in the field name for AuthWidget needs to be
          // consistent with the index in field.value
          visibleServiceIds.has(serviceId) && (
            <div key={serviceId}>
              <ServiceFieldError servicesError={error} fieldIndex={index} />
              <Card className={styles.serviceCard}>
                <ServiceDescriptor
                  serviceId={serviceId}
                  serviceConfigs={serviceConfigs}
                />
                <AuthWidget
                  authOptions={authOptions}
                  serviceId={serviceId}
                  name={joinName(field.name, String(index), "config")}
                  onRefresh={refreshAuthOptions}
                />
              </Card>
            </div>
          )
      )}
    </>
  );
};

export default ServicesBody;
