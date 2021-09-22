/*
 * Copyright (C) 2021 PixieBrix, Inc.
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

import { Transformer } from "@/types";
import { BlockArg, BlockOptions, Schema } from "@/core";
import { frameworkReadFactory } from "@/blocks/readers/frameworkReader";
import { KNOWN_READERS } from "@/messaging/constants";
import { validateRegistryId } from "@/types/helpers";

export const COMPONENT_READER_ID = validateRegistryId(
  "@pixiebrix/component-reader"
);

export class ComponentReader extends Transformer {
  constructor() {
    super(
      COMPONENT_READER_ID,
      "Component Reader",
      "Extract data from a front-end component (e.g., React, Vue, Ember, etc.)"
    );
  }

  defaultOutputKey = "data";

  inputSchema: Schema = {
    type: "object",
    required: ["framework", "selector"],
    properties: {
      framework: {
        type: "string",
        enum: KNOWN_READERS.filter((x) => x !== "jquery"),
      },
      selector: {
        type: "string",
        format: "selector",
        description:
          "CSS/JQuery selector to select the HTML element that corresponds to the component",
      },
      optional: {
        type: "boolean",
        default: false,
        description: "Whether or not the selector is always available",
      },
      traverseUp: {
        type: "number",
        description: "Traverse non-visible framework elements",
      },
    },
  };

  async isPure(): Promise<boolean> {
    return true;
  }

  async transform(
    { framework, selector }: BlockArg,
    { root }: BlockOptions
  ): Promise<unknown> {
    return frameworkReadFactory(framework)({ framework, selector }, root);
  }
}
