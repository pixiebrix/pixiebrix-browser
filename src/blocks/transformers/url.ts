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

import { Transformer } from "@/types";
import { type BlockArg, type Schema } from "@/core";
import {
  makeURL,
  URL_INPUT_SPACE_ENCODING_DEFAULT,
  LEGACY_URL_INPUT_SPACE_ENCODING_DEFAULT,
} from "@/utils";

export const URL_INPUT_SPEC: Schema = {
  $schema: "https://json-schema.org/draft/2019-09/schema#",
  type: "object",
  properties: {
    url: {
      type: "string",
      description: "The URL",
      format: "uri",
    },
    params: {
      type: "object",
      description: "URL parameters, will be automatically encoded",
      additionalProperties: { type: ["string", "number", "boolean"] },
    },
    spaceEncoding: {
      type: "string",
      description: "Encode space using %20 vs. +",
      default: URL_INPUT_SPACE_ENCODING_DEFAULT,
      enum: ["percent", "plus"],
    },
  },
  required: ["url"],
};

export class UrlParams extends Transformer {
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
  }: BlockArg): Promise<{ url: string }> {
    return {
      url: makeURL(url, params, spaceEncoding),
    };
  }
}
