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

import { type RegistryId } from "@/core";
import { validateRegistryId } from "@/types/helpers";

/**
 * The PixieBrix API integration definition.
 */
export const PIXIEBRIX_SERVICE_ID: RegistryId =
  validateRegistryId("@pixiebrix/api");

export const AUTOMATION_ANYWHERE_PARTNER_KEY = "automation-anywhere";

// Automation Anywhere partner service definition constants
export const CONTROL_ROOM_SERVICE_ID: RegistryId = validateRegistryId(
  "automation-anywhere/control-room"
);
export const CONTROL_ROOM_OAUTH_SERVICE_ID: RegistryId = validateRegistryId(
  "automation-anywhere/oauth2"
);
