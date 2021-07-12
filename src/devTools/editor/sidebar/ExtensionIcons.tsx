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
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ADAPTERS } from "@/devTools/editor/extensionPoints/adapter";
import {
  faEyeSlash,
  faPuzzlePiece,
  faSave,
} from "@fortawesome/free-solid-svg-icons";
import { ElementType } from "@/devTools/editor/extensionPoints/elementConfig";

export const ExtensionIcon: React.FunctionComponent<{ type: ElementType }> = ({
  type,
}) => {
  return <FontAwesomeIcon icon={ADAPTERS.get(type)?.icon ?? faPuzzlePiece} />;
};

export const NotAvailableIcon: React.FunctionComponent = () => (
  <FontAwesomeIcon icon={faEyeSlash} title="Not available on page" />
);

export const UnsavedChangesIcon: React.FunctionComponent = () => (
  <FontAwesomeIcon icon={faSave} title="Unsaved changes" />
);
