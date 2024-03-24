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

import { type UUID } from "@/types/stringTypes";
import { getToken } from "@/background/auth/getToken";
import { uuidv4 } from "@/types/helpers";
import nock from "nock";

const getOneToken = async (id: UUID) =>
  getToken(
    {
      // @ts-expect-error The result isn't necessary at this time
      getTokenContext: () => ({
        url: "http://example.com/api",
      }),
      isToken: true,
    },
    { id },
  );

describe("getToken", () => {
  test("multiple requests are temporarily memoized", async () => {
    let userId = 0;
    nock("http://example.com")
      .post("/api")
      .times(5)
      .reply(200, () => userId++);

    const id1 = uuidv4();
    // Consecutive calls should make new requests
    await expect(getOneToken(id1)).resolves.toBe(0);
    await expect(getOneToken(id1)).resolves.toBe(1);

    // Parallel calls should make one request
    await expect(
      Promise.all([getOneToken(id1), getOneToken(id1)]),
    ).resolves.toStrictEqual([2, 2]);

    // Parallel calls but with different auth.id’s should make multiple requests
    const id2 = uuidv4();
    await expect(
      Promise.all([getOneToken(id1), getOneToken(id2)]),
    ).resolves.toStrictEqual([3, 4]);
  });
});
