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

import { TransformerABC } from "@/types/bricks/transformerTypes";
import { type Schema } from "@/types/schemaTypes";
import { propertiesToSchema } from "@/validators/generic";
import { getReferenceForElement } from "@/contentScript/elementReference";

export class SelectElement extends TransformerABC {
  constructor() {
    super(
      "@pixiebrix/html/select",
      "Select Element on Page",
      "Prompt the user to select an element on the page"
    );
  }

  defaultOutputKey = "selected";

  // In the future, can add options for selecting multiple elements, providing instructions to the user, filtering
  // valid elements, etc.
  inputSchema: Schema = {
    type: "object",
    properties: {},
    additionalProperties: false,
  };

  override outputSchema: Schema = propertiesToSchema({
    elements: {
      type: "array",
      description: "The array of element references selected",
      items: {
        $ref: "https://app.pixiebrix.com/schemas/element#",
      },
    },
  });

  async transform(): Promise<unknown> {
    // Include here to avoid error during header generation (which runs in node environment)
    const { userSelectElement } = await import(
      /* webpackChunkName: "editorContentScript" */ "@/contentScript/pageEditor/elementPicker"
    );

    const { elements } = await userSelectElement();

    const elementRefs = elements.map((element) =>
      getReferenceForElement(element)
    );

    return {
      elements: elementRefs,
    };
  }
}
