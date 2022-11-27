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

import getLikelyVariableAtPosition from "./getLikelyVariableAtPosition";

test.each([
  [0, null], // Before the first variable
  [6, null], // Inside the braces right before the variable
  [7, "@foo"], // At the start of the variable
  [11, "@foo"], // At the end of the variable
  [12, null], // After the variable
  [20, null], // On the braces before the second variable
  [21, "@bar.baz"], // At the start of the second variable
  [29, "@bar.baz"], // At the end of the second variable
  [30, null], // On the braces after the second variable
])("returns variable at given position %s", (position, expected) => {
  const template = "abc {{ @foo }} xyz {{@bar.baz}}.";
  const actual = getLikelyVariableAtPosition(template, position);
  expect(actual).toEqual(expected);
});

test.each([
  [10, null], // In the middle of the item variable "qux"
  [17, "@foo.bar.baz"], // At the start of the variable in the for loop "@foo.bar.baz"
  [29, "@foo.bar.baz"], // At the end of the variable in the for loop "@foo.bar.baz"
  [60, null], // In the middle of the item variable "qux.quux.quuux"
  [90, "@corge.grault.garply"], // At the beginning of the context variable in the loop body "@corge.grault.garply"
])("multiline template, variable at position %s", (position, expected) => {
  const template = `
  {% for qux in @foo.bar.baz %}
    Item value: {{ qux.quux.quuux }}
    Context var: {{ @corge.grault.garply }}
  {% endfor %}`;

  const actual = getLikelyVariableAtPosition(template, position);
  expect(actual).toEqual(expected);
});

test.each([8, 23])("repeated variables at position %s", (position) => {
  const template = "abc {{ @foo }} xyz {{@foo}}.";
  const actual = getLikelyVariableAtPosition(template, position);
  expect(actual).toEqual("@foo");
});

test("indexed access", () => {
  const template = "abc {{ @foo[0].bar }}.";
  const actual = getLikelyVariableAtPosition(template, 8);
  expect(actual).toEqual("@foo[0].bar");
});

test("access with []", () => {
  const template = "abc {{ @foo['bar baz'] }}.";
  const actual = getLikelyVariableAtPosition(template, 8);
  expect(actual).toEqual("@foo['bar baz']");
});
