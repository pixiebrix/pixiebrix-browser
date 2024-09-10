/*
 * Copyright (C) 2024 PixieBrix, Inc.
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

import { RendererABC } from "@/types/bricks/rendererTypes";
import sanitize, { ADD_IFRAME_CONFIG } from "@/utils/sanitize";
import { type BrickArgs } from "@/types/runtimeTypes";
import { type SafeHTML } from "@/types/stringTypes";
import { validateRegistryId } from "@/types/helpers";
import { propertiesToSchema } from "@/utils/schemaUtils";

class HtmlRenderer extends RendererABC {
  static BRICK_ID = validateRegistryId("@pixiebrix/html");

  constructor() {
    super(
      HtmlRenderer.BRICK_ID,
      "HTML Renderer",
      "Render HTML, sanitizing it first",
    );
  }

  inputSchema = propertiesToSchema(
    {
      html: {
        title: "HTML",
        type: "string",
        description: "The HTML string to render",
      },
      /**
       * @since 2.1.2
       */
      css: {
        title: "CSS",
        type: "string",
        description: "Custom CSS to apply to the rendered HTML",
        default: "",
      },
      /**
       * @since 2.1.2
       */
      javascript: {
        title: "JavaScript",
        type: "string",
        description: "Custom JavaScript to run after the HTML is rendered",
        default: "",
      },
      /**
       * @since 1.8.5
       */
      allowIFrames: {
        title: "Allow IFrames",
        type: "boolean",
        description:
          "Toggle to allow the iframe tag and generally safe frame attributes",
        default: false,
      },
    },
    ["html"],
  );

  async render({
    html,
    allowIFrames = false,
    css = "",
    javascript = "",
  }: BrickArgs<{
    html: string;
    allowIFrames?: boolean;
    css?: string;
    javascript?: string;
  }>): Promise<SafeHTML> {
    let result = sanitize(html, allowIFrames ? ADD_IFRAME_CONFIG : undefined);
    if (css) {
      result = `<style>${css}</style>${result}` as SafeHTML;
    }

    if (javascript) {
      result = `${result}<script>${javascript}</script>` as SafeHTML;
    }

    return result;
  }
}

export default HtmlRenderer;
