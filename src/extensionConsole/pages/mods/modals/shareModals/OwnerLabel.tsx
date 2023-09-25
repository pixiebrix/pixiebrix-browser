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

import { selectAuth } from "@/auth/authSelectors";
import useSortOrganizations from "@/extensionConsole/pages/mods/modals/shareModals/useSortOrganizations";
import { useOptionalModDefinition } from "@/modDefinitions/modDefinitionHooks";
import { type RegistryId } from "@/types/registryTypes";
import { getScopeAndId } from "@/utils/registryUtils";
import { faUser, faUsers } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import { useSelector } from "react-redux";

const OwnerLabel: React.FunctionComponent<{ blueprintId: RegistryId }> = ({
  blueprintId,
}) => {
  const { scope: userScope } = useSelector(selectAuth);

  const { data: recipe } = useOptionalModDefinition(blueprintId);

  const sortedOrganizations = useSortOrganizations();

  const [recipeScope] = getScopeAndId(recipe?.metadata.id);

  if (recipeScope === userScope) {
    return (
      <span>
        <FontAwesomeIcon icon={faUser} /> You
      </span>
    );
  }

  const ownerOrganization = sortedOrganizations.find(
    (x) => x.scope === recipeScope
  );

  if (!ownerOrganization) {
    return (
      <span>
        <FontAwesomeIcon icon={faUsers} /> Unknown
      </span>
    );
  }

  return (
    <span>
      <FontAwesomeIcon icon={faUsers} /> {ownerOrganization.name}
    </span>
  );
};

export default OwnerLabel;
