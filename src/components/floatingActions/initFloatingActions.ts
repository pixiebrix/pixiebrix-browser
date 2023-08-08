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

import { isLoadedInIframe } from "@/utils/iframeUtils";
import { getSettingsState } from "@/store/settingsStorage";
import { getUserData } from "@/background/messenger/api";
import { DEFAULT_THEME } from "@/themes/themeTypes";
import { syncFlagOn } from "@/store/syncFlags";

/**
 * Add the floating action button to the page if the user is not an enterprise/partner user.
 *
 * Split from FloatingActions.tsx to avoid importing React in frames that don't need it.
 */
export default async function initFloatingActions(): Promise<void> {
  if (isLoadedInIframe()) {
    // Skip expensive checks
    return;
  }

  const [settings, { telemetryOrganizationId }] = await Promise.all([
    getSettingsState(),
    getUserData(),
  ]);

  // `telemetryOrganizationId` indicates user is part of an enterprise organization
  // See https://github.com/pixiebrix/pixiebrix-app/blob/39fac4874402a541f62e80ab74aaefd446cc3743/api/models/user.py#L68-L68
  // Just get the theme from the store instead of using getActive theme to avoid extra Chrome storage reads
  // In practice, the Chrome policy should not change between useGetTheme and a call to initFloatingActions on a page
  const isEnterpriseOrPartnerUser =
    Boolean(telemetryOrganizationId) || settings.theme !== DEFAULT_THEME;

  // Add floating action button if the feature flag and settings are enabled
  // XXX: consider moving checks into React component, so we can use the Redux context
  if (
    settings.isFloatingActionButtonEnabled &&
    // XXX: there's likely a race here with when syncFlagOn gets the flag from localStorage. But in practice, this
    // seems to work fine. (Likely because the flags will be loaded by the time the Promise.all above resolves)
    syncFlagOn("floating-quickbar-button-freemium") &&
    !isEnterpriseOrPartnerUser
  ) {
    const { renderFloatingActions } = await import(
      /* webpackMode: "lazy" */
      /* webpackChunkName: "fab" */ "@/components/floatingActions/FloatingActions"
    );
    await renderFloatingActions();
  }
}
