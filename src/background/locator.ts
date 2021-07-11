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

import LazyLocatorFactory from "@/services/locator";
import { liftBackground } from "@/background/protocol";
import { isBackgroundPage } from "webext-detect-page";

export const locator = new LazyLocatorFactory();

async function initLocator() {
  await locator.refresh();
}

export const locate = liftBackground(
  "LOCATE_SERVICE",
  async (serviceId: string, id: string | null) => locator.locate(serviceId, id)
);

export const refresh: (options?: {
  local: boolean;
  remote: boolean;
}) => Promise<unknown> = liftBackground(
  "REFRESH_SERVICES",
  async ({ local = true, remote = true }) => {
    if (remote && local) {
      await locator.refresh();
    } else if (remote) {
      await locator.refreshRemote();
    } else if (local) {
      await locator.refreshLocal();
    }
  },
  {
    asyncResponse: false,
  }
);

if (isBackgroundPage()) {
  void initLocator().then(() => {
    console.debug("Eagerly initialized service locator");
  });
}
