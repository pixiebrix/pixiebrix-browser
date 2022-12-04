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

import { type Manifest, type Permissions } from "webextension-polyfill";
import { cloneDeep, remove, uniq } from "lodash";
import {
  containsPermissions,
  openPopupPrompt,
} from "@/background/messenger/api";
import { isScriptableUrl as _isScriptableUrl } from "webext-content-scripts";
import { isUrlPermittedByManifest } from "webext-additional-permissions";
import {
  getTabUrl,
  canAccessTab as _canAccessTab,
  type Target,
} from "webext-tools";

/** Filters out any permissions that are not part of `optional_permissions` */
export function selectOptionalPermissions(
  permissions: string[]
): Manifest.OptionalPermission[] {
  const { optional_permissions } = browser.runtime.getManifest();
  return permissions.filter((requestedPermission) =>
    optional_permissions.includes(requestedPermission)
  ) as Manifest.OptionalPermission[];
}

/** Merge a list of permissions into a single permissions object */
export function mergePermissions(
  permissions: Permissions.Permissions[] = []
): Required<Permissions.Permissions> {
  return {
    origins: uniq(permissions.flatMap((x) => x.origins ?? [])),
    permissions: uniq(permissions.flatMap((x) => x.permissions ?? [])),
  };
}

// TODO: Make it work in content scripts as well, or any context that doesn't have the API
/** An alternative API to permissions.request() that works in Firefox’ Dev Tools */
export async function requestPermissions(
  permissions: Permissions.Permissions
): Promise<boolean> {
  // We're going to alter this object so we should clone it
  permissions = cloneDeep(permissions);

  // Don't request permissions for pixiebrix.com, the browser will always show a prompt.
  // We can't use `await containsPermissions()` before `request() `because we might lose the "user action" flag
  // https://github.com/pixiebrix/pixiebrix-extension/issues/1759
  if (Array.isArray(permissions.origins)) {
    remove(permissions.origins, (origin) => isUrlPermittedByManifest(origin));
  }

  if (browser.permissions) {
    return browser.permissions.request(permissions);
  }

  if (await containsPermissions(permissions)) {
    return true;
  }

  const page = new URL(browser.runtime.getURL("permissionsPopup.html"));
  for (const origin of permissions.origins ?? []) {
    page.searchParams.append("origin", origin);
  }

  for (const permission of permissions.permissions ?? []) {
    page.searchParams.append("permission", permission);
  }

  // TODO: This only works in the Dev Tools; We should query the current or front-most window
  //  when this is missing in order to make it work in other contexts as well
  const { tabId } = browser.devtools.inspectedWindow;
  await openPopupPrompt(tabId, page.toString());
  return containsPermissions(permissions);
}

/**
 * Determines whether a URL can potentially execute a content script.
 * This excludes non-https URLs and extension gallery pages.
 */
export function isScriptableUrl(url?: string): boolean {
  return url?.startsWith("https") && _isScriptableUrl(url);
}

export function makeEmptyPermissions(): Permissions.Permissions {
  return { origins: [], permissions: [] };
}

/**
 * Determines whether PixieBrix can access the tab, depending on permissions and
 * artificial protocol-based limitations
 */
export async function canAccessTab(tab: number | Target): Promise<boolean> {
  const urlPromise = getTabUrl(tab);
  const accessPromise = _canAccessTab(tab);
  // We may have `activeTab` (_canAccessTab), but we don't support non-HTTPS websites (!isScriptableUrl)
  return isScriptableUrl(await urlPromise) && accessPromise;
}
