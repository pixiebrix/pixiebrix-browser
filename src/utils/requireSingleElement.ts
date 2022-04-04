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

import { MultipleElementsFoundError, NoElementsFoundError } from "@/errors";

/**
 * Returns exactly one HTMLElement corresponding to the given selector.
 * @param selector the jQuery selector
 * @throws NoElementsFoundError if not elements are found
 * @throws MultipleElementsFoundError if multiple elements are found
 */
export function requireSingleElement<Element extends HTMLElement>(
  selector: string,
  parent: Document | HTMLElement | JQuery<HTMLElement | Document> = document
): Element {
  const $elements = $(parent).find<Element>(selector);
  if ($elements.length === 0) {
    throw new NoElementsFoundError(selector);
  }

  if ($elements.length > 1) {
    throw new MultipleElementsFoundError(selector);
  }

  return $elements.get(0);
}
