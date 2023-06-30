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

import { Effect } from "@/types/bricks/effectTypes";
import { type Schema } from "@/types/schemaTypes";
import { propertiesToSchema } from "@/validators/generic";
import { toggleQuickBar } from "@/components/quickBar/QuickBarApp";

class ToggleQuickbarEffect extends Effect {
  constructor() {
    super(
      "@pixiebrix/quickbar/toggle",
      "Toggle Quick Bar",
      "Show/Hide the PixieBrix Quick Bar"
    );
  }

  override async isRootAware(): Promise<boolean> {
    return false;
  }

  // In the future, we'll expose a "mode" with: "toggle", "show", and "hide" options
  inputSchema: Schema = propertiesToSchema({}, []);

  async effect(): Promise<void> {
    toggleQuickBar();
  }
}

export default ToggleQuickbarEffect;
