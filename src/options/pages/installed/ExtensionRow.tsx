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
import { ExtensionRef, ResolvedExtension } from "@/core";
import {
  ExtensionValidationResult,
  useExtensionValidator,
} from "@/validators/generic";
import { BeatLoader } from "react-spinners";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faExclamation } from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";
import AsyncButton from "@/components/AsyncButton";
import useExtensionPermissions from "@/options/pages/installed/useExtensionPermissions";
import useNotifications from "@/hooks/useNotifications";

type RemoveAction = (identifier: ExtensionRef) => void;

function validationMessage(validation: ExtensionValidationResult) {
  let message = "Invalid Configuration";
  if (validation.notConfigured.length > 0) {
    const services = validation.notConfigured.map((x) => x.serviceId);
    if (services.length > 1) {
      message = `You need to select configurations for ${services.join(", ")}`;
    } else {
      message = `You need to select a configuration for ${services[0]}`;
    }
  } else if (validation.missingConfiguration.length > 0) {
    const services = validation.missingConfiguration.map((x) => x.serviceId);
    message = `
      The following services use configurations that no longer exist: ${services.join(
        ", "
      )}`;
  } else {
    console.debug("Validation result", validation);
  }

  return message;
}

const ExtensionRow: React.FunctionComponent<{
  extension: ResolvedExtension;
  onRemove: RemoveAction;
}> = ({ extension, onRemove }) => {
  const { id, label, extensionPointId } = extension;
  const notify = useNotifications();

  const [hasPermissions, requestPermissions] = useExtensionPermissions(
    extension
  );

  const [validation] = useExtensionValidator(extension);

  const statusElt = useMemo(() => {
    if (hasPermissions == null || validation == null) {
      return <BeatLoader />;
    }

    if (validation && !validation.valid) {
      return (
        <span className="text-danger text-wrap">
          <FontAwesomeIcon icon={faExclamation} />{" "}
          {validationMessage(validation)}
        </span>
      );
    }

    if (hasPermissions) {
      return (
        <span>
          <FontAwesomeIcon icon={faCheck} /> Active
        </span>
      );
    }

    return (
      <AsyncButton variant="info" size="sm" onClick={requestPermissions}>
        Grant Permissions
      </AsyncButton>
    );
  }, [hasPermissions, requestPermissions, validation]);

  return (
    <tr>
      <td>&nbsp;</td>
      <td>
        <Link to={`/workshop/extensions/${id}`}>{label ?? id}</Link>
      </td>
      <td className="text-wrap">{statusElt}</td>
      <td>
        <AsyncButton
          variant="danger"
          size="sm"
          onClick={() => {
            onRemove({ extensionId: id, extensionPointId });
            notify.success(`Removed brick ${label ?? id}`, {
              event: "ExtensionRemove",
            });
          }}
        >
          Uninstall
        </AsyncButton>
      </td>
    </tr>
  );
};

export default ExtensionRow;
