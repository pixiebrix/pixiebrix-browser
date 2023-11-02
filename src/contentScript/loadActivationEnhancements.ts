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

// WARNING: this file MUST NOT directly or transitively import webext-messenger because it does not support being
// imported multiple times in the same contentScript. It's only safe to import webext-messenger in contentScriptCore.ts
// which is behind a guarded dynamic import.

import { initRuntimeLogging } from "@/development/runtimeLogging";
import { loadActivationEnhancements } from "@/contentScript/loadActivationEnhancementsCore";
// eslint-disable-next-line prefer-destructuring -- process.env substitution
const DEBUG = process.env.DEBUG;

void initRuntimeLogging();

if (location.protocol === "https:" || DEBUG) {
  void loadActivationEnhancements();
} else {
  console.warn("Unsupported protocol", location.protocol);
}
