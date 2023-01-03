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

import { type ElementInfo } from "@/pageScript/frameworks";
import { getSuggestionsForElement } from "./SelectorSelectorWidget";

test("getSuggestionsForElement", () => {
  const elementInfo = {
    selectors: ["a", "#a"],
    parent: {
      selectors: [".a"],
    },
  } as ElementInfo;
  expect(getSuggestionsForElement(elementInfo, { sort: false })).toMatchObject([
    { value: "a" },
    { value: "#a" },
    { value: ".a" },
  ]);
  expect(getSuggestionsForElement(elementInfo, { sort: true })).toMatchObject([
    { value: "#a" },
    { value: ".a" },
    { value: "a" },
  ]);
});
