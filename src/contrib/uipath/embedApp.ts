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

import { Renderer, UnknownObject } from "@/types";
import { isEmpty } from "lodash";
import { BlockArg, BlockOptions, RegistryId, SafeHTML, Schema } from "@/core";
import { uuidv4 } from "@/types/helpers";
import browser, { Permissions } from "webextension-polyfill";
import { unsafeAssumeValidArg } from "@/runtime/runtimeTypes";
import { waitForTargetByUrl } from "@/background/messenger/api";
import { runBrick } from "@/contentScript/messenger/api";
import pTimeout from "p-timeout";

interface RunDetails {
  blockId: RegistryId;
  inputs: unknown;
  url: URL;
}

async function runInFrame({
  blockId,
  inputs,
  url,
}: RunDetails): Promise<unknown> {
  const target = await pTimeout(
    waitForTargetByUrl(url.href),
    2000,
    // `waitForTargetByUrl` is expected to respond quickly because
    // it listens to the target creation event before its content even starts loading.
    // With the nested iframe creation overhead this should be between 100 and 500ms
    "The expected frame was not created within 2 seconds"
  );

  return runBrick(target, {
    blockId: "@pixiebrix/forms/set" as RegistryId,
    blockArgs: unsafeAssumeValidArg({
      inputs: Object.entries(inputs).map(([key, value]) => ({
        selector: `[placeholder="in:${key}"]`,
        value,
      })),
    }),
    options: {
      isAvailable: {
        // UiPath apps lazy load the inputs, so make sure they've been rendered before trying
        // to set the values
        selectors: [".root-container input"],
      },
      ctxt: {},
      messageContext: {
        blockId,
      },
    },
  });
}

export class UiPathAppRenderer extends Renderer {
  constructor() {
    super(
      "@pixiebrix/uipath/app",
      "UiPath App",
      "Render a UiPath App with optional parameters"
    );
  }

  override permissions: Permissions.Permissions = {
    origins: ["https://cloud.uipath.com/*"],
  };

  inputSchema: Schema = {
    $schema: "https://json-schema.org/draft/2019-09/schema#",
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The full UiPath app URL",
      },
      inputs: {
        type: "object",
        description: "Optional inputs to pass to the app",
        additionalProperties: true,
      },
      title: {
        type: "string",
        description: "The title of the iframe",
        default: "UiPath App",
      },
      width: {
        type: "string",
        description: "The width of the iframe",
        default: "100%",
      },
      height: {
        type: "string",
        description: "The height of the iframe",
        default: "400",
      },
    },
    required: ["url"],
  };

  async render(
    {
      url,
      inputs: rawInputs = {},
      title = "UiPath App",
      height = 400,
      width = "100%",
    }: BlockArg,
    { logger }: BlockOptions
  ): Promise<SafeHTML> {
    const nonce = uuidv4();

    // Use extension iframe to get around the host’s CSP limitations
    // https://transitory.technology/browser-extensions-and-csp-headers/
    const subframeUrl = new URL(url);
    subframeUrl.searchParams.set("_pb", nonce);

    const localFrame = new URL(browser.runtime.getURL("frame.html"));
    localFrame.searchParams.set("url", subframeUrl.href);

    const inputs = rawInputs as UnknownObject;
    if (!isEmpty(inputs)) {
      void runInFrame({
        blockId: this.id,
        url: subframeUrl,
        inputs,
      })
        // eslint-disable-next-line promise/prefer-await-to-then -- It must run asynchronously
        .catch((error) => {
          logger.error(error);
        });
    }

    return `<iframe src="${localFrame.href}" title="${title}" height="${height}" width="${width}" style="border:none;"></iframe>` as SafeHTML;
  }
}
