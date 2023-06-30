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

import { unsafeAssumeValidArg } from "@/runtime/runtimeTypes";
import ConsoleLogger from "@/utils/ConsoleLogger";
import { type BrickOptions } from "@/types/runtimeTypes";
import { HideEffect } from "@/blocks/effects/hide";

import { uuidSequence } from "@/testUtils/factories/stringFactories";

const brick = new HideEffect();

const logger = new ConsoleLogger({
  extensionId: uuidSequence(0),
});

describe("HideEffect", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <html>
        <body>
          <button>Click me</button>
        </body>
      </html>
    `;
  });

  test("isRootAware", async () => {
    await expect(brick.isRootAware()).resolves.toBe(true);
  });

  test.each([undefined, false])(
    "it hides element for isRootAware: %s",
    async (isRootAware) => {
      await brick.run(
        unsafeAssumeValidArg({ selector: "button", isRootAware }),
        { root: document, logger } as BrickOptions
      );

      expect(document.querySelector("button")).not.toBeVisible();
    }
  );

  test("it hides element for isRootAware: true", async () => {
    await brick.run(unsafeAssumeValidArg({ isRootAware: true }), {
      root: document.querySelector("button"),
      logger,
    } as unknown as BrickOptions);

    expect(document.querySelector("button")).not.toBeVisible();
  });

  test("it removes element", async () => {
    await brick.run(
      unsafeAssumeValidArg({ isRootAware: true, mode: "remove" }),
      {
        root: document.querySelector("button"),
        logger,
      } as unknown as BrickOptions
    );

    expect(document.querySelector("button")).toBeNull();
  });
});
