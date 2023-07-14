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

import { ReaderABC } from "@/types/bricks/readerTypes";
import { type JsonObject } from "type-fest";
import { type Schema } from "@/types/schemaTypes";

export class PageSemanticReader extends ReaderABC {
  defaultOutputKey = "metadata";

  constructor() {
    super(
      "@pixiebrix/document-semantic",
      "Read semantic data",
      "Read HTML metadata, JSON-LD, RDFa, microdata, OEmbed, Twitter cards and AppLinks."
    );
  }

  override async isRootAware(): Promise<boolean> {
    return false;
  }

  async read(): Promise<JsonObject> {
    const [{ Handler }, { Parser }] = await Promise.all([
      import(/* webpackChunkName: "htmlparsers" */ "htmlmetaparser"),
      import(/* webpackChunkName: "htmlparsers" */ "htmlparser2"),
    ]);

    return new Promise((resolve, reject) => {
      const handler = new Handler(
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result as unknown as JsonObject);
          }
        },
        {
          // The HTML pages URL is used to resolve relative URLs.
          url: document.location.href,
        }
      );

      const parser = new Parser(handler, { decodeEntities: true });
      parser.write(document.documentElement.innerHTML);
      parser.done();
    });
  }

  override async isPure(): Promise<boolean> {
    return true;
  }

  override outputSchema: Schema = {
    $schema: "https://json-schema.org/draft/2019-09/schema#",
    type: "object",
    properties: {
      alternate: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
            },
            href: {
              type: "string",
            },
          },
        },
      },
    },
  };

  async isAvailable() {
    return true;
  }
}
