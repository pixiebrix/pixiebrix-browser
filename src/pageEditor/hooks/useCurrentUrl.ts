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

import { once } from "lodash";
import { useEffect, useState } from "react";
import { SimpleEventTarget } from "@/utils/SimpleEventTarget";
import { type Tabs } from "webextension-polyfill";
import { expectContext } from "@/utils/expectContext";
import { getCurrentURL } from "@/pageEditor/utils";

let lastKnownUrl: string;
const urlChanges = new SimpleEventTarget<string>();

async function onUpdated(
  tabId: number,
  { url }: Tabs.OnUpdatedChangeInfoType,
): Promise<void> {
  if (
    tabId === browser.devtools.inspectedWindow.tabId &&
    lastKnownUrl !== url
  ) {
    lastKnownUrl = url;
    urlChanges.emit(url);
  }
}

const startWatching = once(async () => {
  browser.tabs.onUpdated.addListener(onUpdated);

  // Get initial URL
  lastKnownUrl = await getCurrentURL();
  urlChanges.emit(lastKnownUrl);
});

export default function useCurrentUrl(): string {
  expectContext("pageEditor");

  const [url, setUrl] = useState(lastKnownUrl);

  useEffect(() => {
    urlChanges.add(setUrl);
    void startWatching();
    return () => {
      urlChanges.remove(setUrl);
    };
  }, [setUrl]);

  return url;
}
