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

import SubmitPanelEffect from "@/blocks/effects/submitPanel";
import { SubmitPanelAction } from "@/blocks/errors";
import { unsafeAssumeValidArg } from "@/runtime/runtimeTypes";
import { type BrickArgs } from "@/types/runtimeTypes";
import { type JsonObject } from "type-fest";

describe("SubmitPanelEffect", () => {
  test("defaults detail to empty object", async () => {
    const brick = new SubmitPanelEffect();

    try {
      await brick.effect(
        unsafeAssumeValidArg({ type: "submit" }) as BrickArgs<{
          type: string;
          detail: JsonObject;
        }>
      );
    } catch (error) {
      expect(error).toBeInstanceOf(SubmitPanelAction);
      expect((error as SubmitPanelAction).detail).toEqual({});
      expect((error as SubmitPanelAction).type).toEqual("submit");
    }
  });
});
