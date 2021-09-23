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

import { UnknownObject } from "@/types";
import { IBlock } from "@/core";

export function getExampleBlockConfig(block: IBlock): UnknownObject | null {
  if (block.id === "@pixiebrix/form-modal") {
    return {
      schema: {
        title: "Example Form",
        type: "object",
        properties: {
          example: {
            title: "Example Field",
            type: "string",
            description: "An example form field",
          },
        },
      },
      uiSchema: {},
      cancelable: true,
      submitCaption: "Submit",
    };
  }

  if (block.id === "@pixiebrix/form") {
    return {
      schema: {
        title: "Example Form",
        type: "object",
        properties: {
          notes: {
            title: "Example Notes Field",
            type: "string",
            description: "An example notes field",
          },
        },
      },
      uiSchema: {
        notes: {
          "ui:widget": "textarea",
        },
      },
    };
  }
}
