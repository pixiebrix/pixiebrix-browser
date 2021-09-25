/* eslint-disable filenames/match-exported */
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

import { liftBackground } from "@/background/protocol";
import { browser } from "webextension-polyfill-ts";
import { handleNavigate, reactivateTab } from "@/contentScript/messenger/api";
import { forEachTab } from "@/background/util";

function initNavigation(): void {
  // Updates from the history API
  browser.webNavigation.onHistoryStateUpdated.addListener(handleNavigate);
}

export const reactivate = liftBackground(
  "REACTIVATE",
  async () => {
    console.debug("Reactivate all tabs");
    void forEachTab(reactivateTab);
  },
  { asyncResponse: false }
);

export default initNavigation;
