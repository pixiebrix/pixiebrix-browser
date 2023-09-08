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

import React from "react";
import { Modal } from "react-bootstrap";
import { useSelector } from "react-redux";
import { selectShowPublishContext } from "@/extensionConsole/pages/mods/modals/modModalsSelectors";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInfoCircle, faUsers } from "@fortawesome/free-solid-svg-icons";
import styles from "./ShareModals.module.scss";
import { useOptionalModDefinition } from "@/modDefinitions/modDefinitionHooks";
import { RequireScope } from "@/auth/RequireScope";
import OwnerLabel from "@/extensionConsole/pages/mods/modals/shareModals/OwnerLabel";
import useHasEditPermissions from "@/extensionConsole/pages/mods/modals/shareModals/useHasEditPermissions";
import useSortOrganizations from "@/extensionConsole/pages/mods/modals/shareModals/useSortOrganizations";

type PublishContentLayoutProps = React.PropsWithChildren<{
  title: string;
}>;

const PublishContentLayout: React.FunctionComponent<
  PublishContentLayoutProps
> = ({ title, children }) => {
  const { blueprintId } = useSelector(selectShowPublishContext);
  const { data: recipe } = useOptionalModDefinition(blueprintId);

  const sortedOrganizations = useSortOrganizations();
  const hasEditPermissions = useHasEditPermissions();

  const body = hasEditPermissions ? (
    children
  ) : (
    <Modal.Body>
      <div className="text-info my-3">
        <FontAwesomeIcon icon={faInfoCircle} /> You don&apos;t have permissions
        to change sharing
      </div>
      <div className={styles.row}>
        <OwnerLabel />
        <span className="text-muted">Owner</span>
      </div>
      {sortedOrganizations
        .filter((x) => recipe.sharing.organizations.includes(x.id))
        .map((organization) => (
          <div className={styles.row} key={organization.id}>
            <span>
              <FontAwesomeIcon icon={faUsers} /> {organization.name}
            </span>
          </div>
        ))}
    </Modal.Body>
  );
  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <RequireScope scopeSettingsDescription="To publish a mod, you must first set an account alias for your PixieBrix account">
        {body}
      </RequireScope>
    </>
  );
};

export default PublishContentLayout;
