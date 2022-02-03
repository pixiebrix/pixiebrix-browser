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

import React from "react";
import { useSelector } from "react-redux";
import ScopeSettings from "./ScopeSettings";
import { SettingsState } from "@/store/settingsTypes";
import { isEmpty } from "lodash";

type RootStateWithSettings = {
  settings: SettingsState;
};

/**
 * Ensures that the user has the required scope to view the page.
 * The auth error is not handled here, it is the responsibility of a parent component.
 */
export const RequireScope: React.FunctionComponent<{
  scope: string | null;
  isPending: boolean;
  scopeSettingsTitle: string;
  scopeSettingsDescription: string;
}> = ({
  scope,
  isPending,
  scopeSettingsTitle,
  scopeSettingsDescription,
  children,
}) => {
  const mode = useSelector<RootStateWithSettings, string>(
    ({ settings }) => settings.mode
  );

  // Fetching scope currently performs a network request. Optimistically show the main interface while the scope is being fetched.
  if (mode !== "local" && !isPending && isEmpty(scope)) {
    return (
      <ScopeSettings
        title={scopeSettingsTitle}
        description={scopeSettingsDescription}
      />
    );
  }

  return <>{children}</>;
};
