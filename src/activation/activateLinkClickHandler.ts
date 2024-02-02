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

import { validateRegistryId } from "@/types/helpers";
import { type ModActivationPanelEntry } from "@/types/sidebarTypes";
import notify from "@/utils/notify";
import { compact } from "lodash";
import {
  getEncodedOptionsFromActivateUrl,
  isActivationUrl,
  parseEncodedOptions,
  readIdsFromUrl,
} from "@/activation/activationLinkUtils";

export default function activateLinkClickHandler(
  event: MouseEvent,
  callback: (entry: ModActivationPanelEntry) => void,
): void {
  const path = event.composedPath();
  const target = path[0] as HTMLElement;
  const link = target.closest("a");
  if (!link) {
    return;
  }

  const { href } = link;
  if (!isActivationUrl(href)) {
    return;
  }

  const url = new URL(href);
  const rawIds = readIdsFromUrl(url);

  let modIds;

  try {
    modIds = compact(rawIds.map((x) => validateRegistryId(x)));
  } catch {
    notify.warning(`Invalid mod id in URL: ${href}`);
    return;
  }

  if (modIds.length === 0) {
    notify.warning(`Mod id param not found in activate link url: ${href}`);
    return;
  }

  const encodedOptions = getEncodedOptionsFromActivateUrl(href);
  const initialOptions = parseEncodedOptions(encodedOptions);
  // NOTE: currently applying same options to all mods
  const mods = modIds.map((modId) => ({ modId, initialOptions }));

  event.preventDefault();

  callback({
    type: "activateMods",
    mods,
    heading: "Activating",
  });
}
