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

import { Effect } from "@/types";
import { type BlockArg, type Schema } from "@/core";
import { propertiesToSchema } from "@/validators/generic";
import { $safeFind } from "@/helpers";

export class EnableEffect extends Effect {
  constructor() {
    super(
      "@pixiebrix/enable",
      "Enable Element",
      "Enable an element (e.g., button, input)"
    );
  }

  inputSchema: Schema = propertiesToSchema(
    {
      selector: {
        type: "string",
        format: "selector",
      },
    },
    ["selector"]
  );

  async effect({ selector }: BlockArg<{ selector: string }>): Promise<void> {
    $safeFind(selector).prop("disabled", false);
  }
}
