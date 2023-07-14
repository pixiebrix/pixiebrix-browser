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

import { validateSchema } from "@/extensionConsole/pages/brickEditor/validate";
import trelloBlueprint from "@contrib/recipes/trello-slack.yaml";
import amazonBrick from "@contrib/bricks/amazon-search.yaml";
import v3Blueprint from "@contrib/recipes/v3-example.txt";
import { objToYaml } from "@/utils/objToYaml";

describe("validateSchema", () => {
  test("validates a v1 blueprint", async () => {
    await expect(validateSchema(objToYaml(trelloBlueprint))).resolves.toEqual(
      {}
    );
  });

  test("validates a v3 blueprint", async () => {
    await expect(validateSchema(v3Blueprint)).resolves.toEqual({});

    const value = await validateSchema(v3Blueprint);
    console.debug(value);
  });

  test("validates a brick", async () => {
    await expect(validateSchema(objToYaml(amazonBrick))).resolves.toEqual({});
  });
});
