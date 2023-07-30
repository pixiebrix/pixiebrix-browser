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

import { EffectABC } from "@/types/bricks/effectTypes";
import { type BrickArgs } from "@/types/runtimeTypes";
import { openTab } from "@/background/messenger/api";
import { URL_INPUT_SPEC } from "@/bricks/transformers/url";

import {
  LEGACY_URL_INPUT_SPACE_ENCODING_DEFAULT,
  makeURL,
} from "@/utils/urlUtils";

export class NavigateURLEffect extends EffectABC {
  constructor() {
    super(
      "@pixiebrix/browser/location",
      "Redirect Page",
      "Navigate the current page to a URL",
      "faWindowMaximize"
    );
  }

  inputSchema = URL_INPUT_SPEC;

  async effect({
    url,
    params,
    spaceEncoding = LEGACY_URL_INPUT_SPACE_ENCODING_DEFAULT,
  }: BrickArgs<{
    url: string;
    params?: Record<string, string | number | boolean>;
    spaceEncoding?: "plus" | "percent";
  }>): Promise<void> {
    document.location.href = makeURL(url, params, spaceEncoding);
  }
}

export class OpenURLEffect extends EffectABC {
  constructor() {
    super(
      "@pixiebrix/browser/open-tab",
      "Open a tab",
      "Open a URL in a new tab",
      "faWindowMaximize"
    );
  }

  inputSchema = URL_INPUT_SPEC;

  async effect({
    url,
    params,
    spaceEncoding = LEGACY_URL_INPUT_SPACE_ENCODING_DEFAULT,
  }: BrickArgs<{
    url: string;
    params?: Record<string, string | number | boolean>;
    spaceEncoding?: "plus" | "percent";
  }>): Promise<void> {
    await openTab({
      url: makeURL(url, params, spaceEncoding),
    });
  }
}
