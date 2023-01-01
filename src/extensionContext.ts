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

// Init rollbar early so we get error reporting on the other initialization
import "@/telemetry/reportUncaughtErrors";

// We don't use native, full-page-reload form submissions
// eslint-disable-next-line import/no-unassigned-import -- Auto-initialization
import "@/utils/preventNativeFormSubmission";

// Handles common HTTP errors
import enrichAxiosErrors from "@/utils/enrichAxiosErrors";

enrichAxiosErrors();

// https://webpack.js.org/guides/public-path/#on-the-fly
__webpack_public_path__ = chrome.runtime.getURL("/");

// @ts-expect-error For debugging only
globalThis.$ = $;

if (!("browser" in globalThis)) {
  // @ts-expect-error For debugging only
  globalThis.browser = browser;
}
