/*
 * Copyright (C) 2024 PixieBrix, Inc.
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
import { Button } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import useDeleteElement from "@/pageEditor/documentBuilder/hooks/useDeleteElement";
import { selectActiveDocumentOrFormPreviewElement } from "@/pageEditor/slices/editorSelectors";
import { useSelector } from "react-redux";

type RemoveElementProps = {
  documentBodyName: string;
};

const RemoveElement: React.FC<RemoveElementProps> = ({ documentBodyName }) => {
  const activeElement = useSelector(selectActiveDocumentOrFormPreviewElement);
  const deleteElement = useDeleteElement(documentBodyName);
  const onDelete = async () => {
    await deleteElement(activeElement);
  };

  return (
    <Button onClick={onDelete} variant="danger" size="sm">
      <FontAwesomeIcon icon={faTrash} /> Remove current element
    </Button>
  );
};

export default RemoveElement;
