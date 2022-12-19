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

// Chrome 105 introduced native support for :has, but has a "bug" that breaks support for JQuery pseudo-selectors
// Implementation adapted from: https://github.com/jquery/jquery/issues/5098#issuecomment-1232952901

const originalDocumentQSA = document.querySelectorAll;
const originalElementQSA = Element.prototype.querySelectorAll;

const originalFind = $.find;

function patchedDocumentQSA(this: Document, selectors: string) {
  if (selectors.includes(":has")) {
    // Force use of JQuery for :has
    throw new DOMException();
  }

  return originalDocumentQSA.call(this, selectors);
}

function patchedElementQSA(this: Element, selectors: string) {
  if (selectors.includes(":has")) {
    // Force use of JQuery for :has
    throw new DOMException();
  }

  return originalElementQSA.call(this, selectors);
}

$.find = Object.assign(function (this: JQuery, ...args: unknown[]) {
  document.querySelectorAll = patchedDocumentQSA;
  Element.prototype.querySelectorAll = patchedElementQSA;

  let result;

  try {
    result = originalFind.apply(this, args);
  } finally {
    document.querySelectorAll = originalDocumentQSA;
    Element.prototype.querySelectorAll = originalElementQSA;
  }

  return result;
}, originalFind);
