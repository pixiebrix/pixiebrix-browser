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

import { getSheetIdIntegrationOutputKey } from "@/contrib/google/sheets/core/getSheetIdIntegrationOutputKey";
import { makeVariableExpression } from "@/runtime/expressionCreators";

describe("getSheetServiceOutputKey", () => {
  test("abc", () => {
    expect(
      getSheetIdIntegrationOutputKey(makeVariableExpression("abc"))
    ).toEqual("abc");
  });
  test("@abc", () => {
    expect(
      getSheetIdIntegrationOutputKey(makeVariableExpression("@abc"))
    ).toEqual("abc");
  });
  test("@abc.def", () => {
    expect(
      getSheetIdIntegrationOutputKey(makeVariableExpression("@abc.def"))
    ).toBeUndefined();
  });
  test("@abc.spreadsheetId", () => {
    expect(
      getSheetIdIntegrationOutputKey(
        makeVariableExpression("@abc.spreadsheetId")
      )
    ).toEqual("abc");
  });
  test("@abc.spreadsheetId.def", () => {
    expect(
      getSheetIdIntegrationOutputKey(
        makeVariableExpression("@abc.spreadsheetId.def")
      )
    ).toBeUndefined();
  });
  test("@abc.def.spreadsheetId", () => {
    expect(
      getSheetIdIntegrationOutputKey(
        makeVariableExpression("@abc.def.spreadsheetId")
      )
    ).toBeUndefined();
  });
});
