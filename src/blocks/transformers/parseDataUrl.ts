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
import { registerBlock } from "@/blocks/registry";
import { BlockArg, Schema } from "@/core";
import { propertiesToSchema } from "@/validators/generic";
import { PropError } from "@/errors";

export class ParseDataUrl extends Transformer {
  constructor() {
    super(
      "@pixiebrix/data-url",
      "Parse Data URL",
      "Parse a data: URL, e.g., from a file upload",
      "faCode"
    );
  }

  inputSchema: Schema = propertiesToSchema(
    {
      url: {
        type: "string",
        format: "data-url",
      },
    },
    ["url"]
  );

  outputSchema: Schema = propertiesToSchema({
    mimeType: {
      type: "string",
    },
    body: {
      type: "string",
    },
  });

  async transform({ url }: BlockArg): Promise<unknown> {
    const { default: parseDataURL } = await import("data-urls");
    const { labelToName, decode } = await import("whatwg-encoding");

    const dataURL = parseDataURL(url);

    if (dataURL == null) {
      throw new PropError(
        "Invalid data URL",
        this.id,
        url,
        // Don't pass value because it will be very long
        null
      );
    }

    // If there's no charset parameter, let's just hope it's UTF-8; that seems like a good guess.
    const encodingName = labelToName(
      dataURL.mimeType.parameters.get("charset") || "utf-8"
    );
    const bodyDecoded = decode(dataURL.body, encodingName);

    return {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string -- see documentation for data-urls
      mimeType: dataURL.mimeType.toString(),
      body: bodyDecoded,
    };
  }
}

registerBlock(new ParseDataUrl());
