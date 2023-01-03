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

import { RegexTransformer } from "./regex";
import { unsafeAssumeValidArg } from "@/runtime/runtimeTypes";
import { BusinessError } from "@/errors/businessErrors";

const transformer = new RegexTransformer();

test("unmatched returns empty dict", async () => {
  const result = await transformer.transform(
    unsafeAssumeValidArg({
      regex: "(?<name>ABC)",
      input: "XYZ",
    })
  );
  expect(result).toEqual({});
});

test("matches name", async () => {
  const result = await transformer.transform(
    unsafeAssumeValidArg({
      regex: "(?<name>ABC)",
      input: "ABC",
    })
  );
  expect(result).toEqual({ name: "ABC" });
});

test("handle multiple", async () => {
  const result = await transformer.transform(
    unsafeAssumeValidArg({
      regex: "(?<name>ABC)",
      input: ["ABC", "XYZ"],
    })
  );
  expect(result).toEqual([{ name: "ABC" }, {}]);
});

test("invalid regex is business error", async () => {
  // https://stackoverflow.com/a/61232874/402560

  const promise = transformer.transform(
    unsafeAssumeValidArg({
      regex: "BOOM\\",
    })
  );

  await expect(promise).rejects.toThrow(BusinessError);
  await expect(promise).rejects.toThrow(
    new BusinessError(
      "Invalid regular expression: /BOOM\\/: \\ at end of pattern"
    )
  );
});
