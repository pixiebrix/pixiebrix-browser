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

import {
  hasCKEditorClass,
  isCKEditorElement,
  setCKEditorData,
} from "@/contrib/ckeditor";
import { BusinessError } from "@/errors/businessErrors";

describe("CKEditor", () => {
  test("it detects CKEditor instances", () => {
    const element = document.createElement("div");
    element.classList.add("ck-editor__editable");
    expect(hasCKEditorClass(element)).toBe(true);
  });

  test("it returns CKEditor instance", () => {
    const element = document.createElement("div");
    element.classList.add("ck-editor__editable");
    expect(isCKEditorElement(element)).toBe(false);

    (element as any).ckeditorInstance = {};

    expect(isCKEditorElement(element)).toBe(true);
  });

  test("setData throws business error for non CKEditor", () => {
    const element = document.createElement("div");
    expect(() => {
      setCKEditorData(element, "test");
    }).toThrow(BusinessError);
  });
});
