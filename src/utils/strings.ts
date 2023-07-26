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

/**
 * URL of the marketplace, including `/marketplace/` path, e.g., https://www.pixiebrix.com/marketplace/
 */
// eslint-disable-next-line prefer-destructuring -- breaks EnvironmentPlugin
export const MARKETPLACE_URL = process.env.MARKETPLACE_URL;

export const FieldDescriptions = {
  BLUEPRINT_ID: "A unique id for the mod",
  BLUEPRINT_NAME: "A display name for the mod",
  BLUEPRINT_DESCRIPTION: "A short description of the mod",
  BLUEPRINT_VERSION: "The current mod version",
};
