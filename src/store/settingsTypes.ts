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

import { Theme } from "@/options/types";
import { RegistryId } from "@/core";

export type InstallMode = "local" | "remote";

export type SettingsState = SkunkworksSettings & {
  /**
   * Whether the extension is synced to the app for provisioning.
   *
   * NOTE: `local` is broken in many places. The only current valid value is remote.
   */
  mode: InstallMode;

  /**
   * Time to snooze updates until (in milliseconds from the epoch), or null.
   *
   * The banners still show, however no modals will be shown for the browser extension or team deployments.
   */
  nextUpdate: number | null;

  /**
   * Timestamps the update modal was first shown. Used to calculate time remaining for enforceUpdateMillis
   *
   * @since 1.7.1
   * @see AuthState.enforceUpdateMillis
   */
  updatePromptTimestamp: number | null;

  /**
   * Whether the non-Chrome browser warning has been dismissed.
   */
  browserWarningDismissed: boolean;

  /**
   * Partner id for the user, if any.
   */
  partnerId: string | null;

  /**
   * Registry id of the integration to use for authentication with the PixieBrix server.
   *
   * For partner integrations, PixieBrix is supporting using partner JWT for authenticating. The PixieBrix server
   * verifies the JWT.
   *
   * Only set if the user has provided the settings on the Settings Screen. Otherwise, is determined by configuration
   * of the user's primary organization.
   *
   * @since 1.7.5
   */
  authServiceId: RegistryId | null;

  /**
   * Theme name for the extension
   */
  theme: Theme;
};

export type SkunkworksSettings = {
  /**
   * Experimental feature to suggest HTML elements to select in the Page Editor
   */
  suggestElements?: boolean;

  /**
   * Experimental setting to detect and exclude random classes when generating selectors
   */
  excludeRandomClasses?: boolean;
};
