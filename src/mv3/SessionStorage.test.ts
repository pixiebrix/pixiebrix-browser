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

import { SessionMap, SessionValue } from "./SessionStorage";

test("SessionMap", async () => {
  const map = new SessionMap("jester", import.meta.url);
  await expect(map.get("alpha")).resolves.toBeUndefined();

  await map.set("alpha", 1);
  await expect(map.get("alpha")).resolves.toBe(1);

  // Other props should be left untouched
  await expect(map.get("beta")).resolves.toBeUndefined();

  await map.set("alpha", undefined);
  await expect(map.get("alpha")).resolves.toBeUndefined();
});

test("SessionValue", async () => {
  const map = new SessionValue("jester", import.meta.url);
  await expect(map.get()).resolves.toBeUndefined();

  await map.set(1);
  await expect(map.get()).resolves.toBe(1);

  await map.set(undefined);
  await expect(map.get()).resolves.toBeUndefined();
});
