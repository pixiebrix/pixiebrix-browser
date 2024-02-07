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

import { ReaderABC } from "@/types/bricks/readerTypes";
import { type Schema } from "@/types/schemaTypes";
import axios from "axios";
import { type JsonObject } from "type-fest";
import { ensureJsonObject } from "@/utils/objectUtils";
import { convertDataUrl } from "@/utils/parseDataUrl";

// TODO: I think axios alone can handle all of this, or FileReader can handle both data and blob in a CSP-safe way
async function getData(img: HTMLImageElement): Promise<ArrayBuffer> {
  // Adapted from https://github.com/exif-js/exif-js/blob/master/exif.js#L384
  if (/^data:/i.test(img.src)) {
    // Data URI
    return convertDataUrl(img.src, "ArrayBuffer");
  }

  if (/^blob:/i.test(img.src)) {
    // Object URL
    const blob = await fetch(img.src).then(async (r) => r.blob());
    return blob.arrayBuffer();
  }

  const response = await axios.get(img.src, { responseType: "arraybuffer" });
  if (response.status !== 200) {
    throw new Error(`Error fetching image ${img.src}: ${response.statusText}`);
  }

  return response.data;
}

export class ImageExifReader extends ReaderABC {
  override defaultOutputKey = "image";

  constructor() {
    super(
      "@pixiebrix/image/exif",
      "Image EXIF reader",
      "Read EXIF information from an image element. For remote images, makes an additional request for the image.",
    );
  }

  async read(elementOrDocument: HTMLElement | Document): Promise<JsonObject> {
    const ExifReader = await import(
      /* webpackChunkName: "exifreader" */ "exifreader"
    );

    const element = elementOrDocument as HTMLImageElement;

    if (element?.tagName === "IMG") {
      const buffer = await getData(element);
      // Ensure serializable output
      return ensureJsonObject(ExifReader.load(buffer));
    }

    throw new Error(
      `Expected an image element, got ${element.tagName ?? "document"}`,
    );
  }

  override async isPure(): Promise<boolean> {
    return true;
  }

  override outputSchema: Schema = {
    $schema: "https://json-schema.org/draft/2019-09/schema#",
    type: "object",
    properties: {},
    additionalProperties: true,
  };

  async isAvailable() {
    return true;
  }
}
