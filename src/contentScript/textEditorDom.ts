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

import * as ckeditorDom from "@/contrib/ckeditor/ckeditorDom";
import * as pageScript from "@/pageScript/messenger/api";
import { getSelectorForElement } from "@/contentScript/elementReference";
import textFieldEdit from "text-field-edit";
import { expectContext } from "@/utils/expectContext";

/**
 * @file Text Editor DOM utilities that might call the pageScript.
 *
 * Historically, we've preferred to use `contentScript` except for calls that must be made from the `pageScript`. The
 * advantage is that 1) we don't have pageScript injection coldstart, and 2) there's less of a chance of the host page
 * interfering with our calls.
 *
 * However, we might consider consolidating the logic in the pageScript to simplify calling conventions.
 */

/**
 * Inserts text at the current cursor position in the given element, with support for custom editors, e.g., CKEditor.
 *
 * Current support:
 * - Plain content editable (Gmail, etc.)
 * - CKEditor 4/5
 *
 * @param element the element to insert text into. Can be a text input, textarea, or contenteditable element.
 * @param text the text to insert
 */
export async function insertAtCursorWithCustomEditorSupport({
  element,
  text,
}: {
  element: HTMLElement;
  text: string;
}) {
  expectContext(
    "contentScript",
    "contentScript context required for editor JavaScript integrations",
  );

  // `textFieldEdit` handles focus required to insert the text. But, force focus to enable the user to keep typing
  window.focus();
  element.focus();

  const ckeditor = ckeditorDom.selectCKEditorElement(element);

  if (ckeditor) {
    await pageScript.insertCKEditorData({
      selector: getSelectorForElement(ckeditor),
      value: text,
    });

    return;
  }

  textFieldEdit.insert(element, text);
}
