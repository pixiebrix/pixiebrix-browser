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

import { EffectABC } from "@/types/bricks/effectTypes";
import { CancelError } from "@/errors/businessErrors";
import { type Schema } from "@/types/schemaTypes";
import { type BrickArgs } from "@/types/runtimeTypes";

export class CancelEffect extends EffectABC {
  constructor() {
    super(
      "@pixiebrix/cancel",
      "Cancel current action",
      "Cancels the current action"
    );
  }

  inputSchema: Schema = {
    type: "object",

    properties: {
      message: {
        type: "string",
        description: "Optional cancellation message",
      },
    },
  };

  async effect({ message }: BrickArgs<{ message: string }>): Promise<void> {
    throw new CancelError(message ?? "Action cancelled");
  }
}
