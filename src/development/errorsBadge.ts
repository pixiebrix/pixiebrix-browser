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

import { getErrorMessage, onUncaughtError } from "@/errors/errorHelpers";
import { browserAction } from "@/mv3/api";

let counter = 0;
let timer: NodeJS.Timeout;

function updateBadge(errorMessage: string | null): void {
  void browserAction.setTitle({
    title: errorMessage,
  });
  void browserAction.setBadgeText({
    text: counter ? String(counter) : "",
  });
  void browserAction.setBadgeBackgroundColor({ color: "#F00" });
}

function showBadgeOnBackgroundErrors(error: Error): void {
  counter++;
  if (counter > 20) {
    // https://github.com/pixiebrix/pixiebrix-extension/issues/7430
    // eslint-disable-next-line no-debugger -- This file is already dev-only, it helps us
    debugger;
  }

  // Show the last error as tooltip
  updateBadge(getErrorMessage(error));

  // Reset the counter after some inactivity
  clearTimeout(timer);
  timer = setTimeout(() => {
    counter = 0;
    updateBadge(null); // Resets it
  }, 15_000);
}

if (process.env.ENVIRONMENT === "development") {
  onUncaughtError(showBadgeOnBackgroundErrors);
}
