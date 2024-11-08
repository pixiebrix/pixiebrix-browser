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

import { type AuthRootState } from "./authTypes";
import { LegacyUserRole } from "@/data/model/UserRole";
import { compact } from "lodash";
import { createSelector } from "@reduxjs/toolkit";

const editorRoles = new Set<number>([
  LegacyUserRole.admin,
  LegacyUserRole.developer,
  LegacyUserRole.manager,
]);

export const selectAuth = (state: AuthRootState) => state.auth;
export const selectIsLoggedIn = (state: AuthRootState) =>
  selectAuth(state).isLoggedIn;
export const selectScope = (state: AuthRootState) => selectAuth(state).scope;
export const selectMilestones = (state: AuthRootState) =>
  selectAuth(state).milestones;
export const selectOrganizations = (state: AuthRootState) =>
  selectAuth(state).organizations;
export const selectOrganization = (state: AuthRootState) =>
  selectAuth(state).organization;

export const selectEditableScopes = createSelector(
  selectAuth,
  (state: AuthRootState["auth"]) => {
    const { scope: userScope, organizations } = state;

    const organizationScopes: string[] = compact(
      organizations.map(({ scope, role }) => {
        if (scope && editorRoles.has(role)) {
          return scope;
        }

        return null;
      }),
    );

    return [userScope, ...organizationScopes].filter((x) => x != null);
  },
);
