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

import {
  DOCUMENT_ELEMENT_TYPES,
  DocumentElement,
  DocumentElementType,
} from "./documentBuilderTypes";

export const ROOT_ELEMENT_TYPES: DocumentElementType[] = [
  "header",
  "text",
  "image",
  "container",
  "card",
  "pipeline",
  "button",
  "list",
];

export const PARENT_ELEMENT_TYPES: DocumentElementType[] = [
  "row",
  "column",
  "container",
  "card",
  "list",
];

const allowedChildTypes: Record<string, DocumentElementType[]> = {
  container: ["row", "list"],
  row: ["column", "list"],
  column: ["header", "text", "image", "card", "pipeline", "button", "list"],
  card: ["header", "text", "image", "container", "pipeline", "button", "list"],
  // Any element we can add to the list
  list: DOCUMENT_ELEMENT_TYPES as unknown as DocumentElementType[],
};

export function getAllowedChildTypes(
  parentElement: DocumentElement
): DocumentElementType[] {
  return allowedChildTypes[parentElement.type] ?? [];
}
