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
import { type BrickArgs } from "@/types/runtimeTypes";
import { type Schema } from "@/types/schemaTypes";

import {
  LEGACY_URL_INPUT_SPACE_ENCODING_DEFAULT,
  makeURL,
  URL_INPUT_SPACE_ENCODING_DEFAULT,
} from "@/utils/urlUtils";

export const URL_INPUT_SPEC: Schema = {
  $schema: "https://json-schema.org/draft/2019-09/schema#",
  type: "object",
  properties: {
    url: {
      type: "string",
      title: "URL",
      description: "The URL that will open",
      format: "uri",
    },
    params: {
      type: "object",
      title: "URL parameters",
      description:
        "Enter parameters that will automatically be encoded in your URL. These follow the ‘?’ in the URL bar.",
      additionalProperties: { type: ["string", "number", "boolean"] },
    },
    spaceEncoding: {
      type: "string",
      title: "Space Encoding",
      description: "Select an option for encoding a space in the URL",
      default: URL_INPUT_SPACE_ENCODING_DEFAULT,
      enum: ["percent", "plus"],
    },
  },
  required: ["url"],
};

export class UrlParams extends TransformerABC {
  override async isPure(): Promise<boolean> {
    return true;
  }

  defaultOutputKey = "url";

  constructor() {
    super(
      "@pixiebrix/url-params",
      "Construct URL",
      "Construct a URL with encoded search parameter",
      "faCode"
    );
  }

  inputSchema: Schema = URL_INPUT_SPEC;

  override outputSchema: Schema = {
    type: "object",
    $schema: "https://json-schema.org/draft/2019-09/schema#",
    properties: {
      url: {
        type: "string",
        format: "uri",
      },
    },
    required: ["url"],
  };

  async transform({
    url,
    params,
    spaceEncoding = LEGACY_URL_INPUT_SPACE_ENCODING_DEFAULT,
  }: BrickArgs<{
    url: string;
    params?: Record<string, string | number | boolean>;
    spaceEncoding?: "percent" | "plus";
  }>): Promise<{ url: string }> {
    return {
      url: makeURL(url, params, spaceEncoding),
    };
  }
}
