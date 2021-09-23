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
import { OverlayTrigger, Tooltip } from "react-bootstrap";
import { uuidv4 } from "@/types/helpers";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/free-solid-svg-icons";
import { useField } from "formik";
import styles from "./LockedExtensionPointLabel.module.scss";

const LockedExtensionPointLabel: React.FC<{
  label: string;
  message?: string;
}> = ({ label, message }) => {
  const [{ value: name }] = useField<string>("extensionPoint.metadata.name");
  const defaultMessage = (
    <p>
      Provided by foundation <span className={styles.name}>{name}</span>. Edit
      the foundation in the Workshop.
    </p>
  );

  const renderTooltip = (props: unknown) => (
    <Tooltip id={`${uuidv4()}-tooltip`} {...props}>
      {message ?? defaultMessage}
    </Tooltip>
  );

  return (
    <OverlayTrigger
      placement="top"
      delay={{ show: 250, hide: 400 }}
      overlay={renderTooltip}
    >
      {({ ref, ...rest }) => (
        <span {...rest}>
          {label} <FontAwesomeIcon forwardedRef={ref} icon={faLock} />
        </span>
      )}
    </OverlayTrigger>
  );
};

export default LockedExtensionPointLabel;
