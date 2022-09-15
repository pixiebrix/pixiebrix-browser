/*
 * Copyright (C) 2022 PixieBrix, Inc.
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
import { ServiceDefinition } from "@/types/definitions";

const ServiceDescriptor: React.FunctionComponent<{
  serviceConfigs: ServiceDefinition[];
  serviceId: string;
}> = ({ serviceId, serviceConfigs }) => {
  const config = useMemo(
    () => serviceConfigs?.find((x) => x.metadata.id === serviceId),
    [serviceId, serviceConfigs]
  );

  return (
    <div className={styles.serviceCardHeader}>
      {config && (
        <h5 className={styles.serviceHeading}>{config.metadata.name}</h5>
      )}
      <code className={styles.serviceId}>{serviceId}</code>
    </div>
  );
};

export default ServiceDescriptor;
