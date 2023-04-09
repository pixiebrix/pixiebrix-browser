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

import { setComponentData } from "@/pageScript/messenger/api";

import { Effect } from "@/types/blocks/effectTypes";
import { type BlockArgs } from "@/types/runtimeTypes";
import { type Schema } from "@/types/schemaTypes";

export class SetVueValues extends Effect {
  constructor() {
    super(
      "@pixiebrix/vue/set-values",
      "Set Vue.js values",
      "Set values on a Vue.js component"
    );
  }

  inputSchema: Schema = {
    type: "object",
    properties: {
      component: {
        type: "string",
        description: "jQuery selector for the Vue.js component",
      },
      values: {
        type: "object",
        description:
          "Mapping from property path to new value (see https://lodash.com/docs/4.17.15#set)",
        minProperties: 1,
        additionalProperties: true,
      },
    },
    required: ["component", "values"],
  };

  async effect({
    component: selector,
    values: valueMap,
  }: BlockArgs): Promise<void> {
    await setComponentData({ framework: "vue", selector, valueMap });
  }
}
