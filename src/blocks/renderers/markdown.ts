/*
 * Copyright (C) 2022 PixieBrix, Inc.
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

import { Renderer } from "@/types";
import { propertiesToSchema } from "@/validators/generic";
import { type BlockArg, type ComponentRef } from "@/core";
import { validateRegistryId } from "@/types/helpers";
import MarkdownLazy from "@/components/MarkdownLazy";

export class MarkdownRenderer extends Renderer {
  static BLOCK_ID = validateRegistryId("@pixiebrix/markdown");

  constructor() {
    super(
      MarkdownRenderer.BLOCK_ID,
      "Render Markdown",
      "Render Markdown to sanitized HTML"
    );
  }

  inputSchema = propertiesToSchema(
    {
      markdown: {
        type: "string",
        description: "The Markdown to render",
        format: "markdown",
      },
    },
    ["markdown"]
  );

  async render({ markdown }: BlockArg): Promise<ComponentRef> {
    return {
      Component: MarkdownLazy,
      props: {
        markdown,
      },
    };
  }
}
