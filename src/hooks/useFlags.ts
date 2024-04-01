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

import { useEffect, useMemo } from "react";
import { useGetFeatureFlagsQuery } from "@/data/service/api";
import {
  addListener as addAuthStorageListener,
  removeListener as removeAuthStorageListener,
} from "@/auth/authStorage";
import type { AsyncState } from "@/types/sliceTypes";
import { mergeAsyncState } from "@/utils/asyncStateUtils";

const RESTRICTED_PREFIX = "restricted";

// Flags controlled on backend at http://github.com/pixiebrix/pixiebrix-app/blob/f082ff5161ff79f696d9a8c35c755430e88fa4ab/api/serializers/account.py#L173-L173
type RestrictedFeature =
  | "workshop"
  | "services"
  | "permissions"
  | "reset"
  | "marketplace"
  | "uninstall"
  | "clear-token"
  | "service-url"
  | "page-editor";

export type Restrict = {
  permit: (area: RestrictedFeature) => boolean;
  restrict: (area: RestrictedFeature) => boolean;
  flagOn: (flag: string) => boolean;
  flagOff: (flag: string) => boolean;
};

type HookResult = Restrict & {
  // The async state for use in deriving values that require valid flags. NOTE: the data is not serializable,
  // so the state might not work with any state helpers that require serializable data (e.g., due to cloning, Immer,
  // or Redux).
  state: AsyncState<Restrict>;
};

/**
 * Hook for feature flags and organization restrictions.
 *
 * For permit/restrict, features will be restricted in the fetching/loading state
 */
function useFlags(): HookResult {
  const queryState = useGetFeatureFlagsQuery();
  const { refetch } = queryState;

  useEffect(() => {
    const listener = () => {
      void refetch();
    };

    addAuthStorageListener(listener);

    return () => {
      removeAuthStorageListener(listener);
    };
  }, [refetch]);

  return useMemo(() => {
    const flagSet = new Set(queryState.data);

    const helpers: Restrict = {
      permit: (area: RestrictedFeature) =>
        !flagSet.has(`${RESTRICTED_PREFIX}-${area}`),
      restrict: (area: RestrictedFeature) =>
        flagSet.has(`${RESTRICTED_PREFIX}-${area}`),
      flagOn: (flag: string) => flagSet.has(flag),
      flagOff: (flag: string) => !flagSet.has(flag),
    };

    return {
      ...helpers,
      state: mergeAsyncState(queryState, () => helpers),
    };
  }, [queryState]);
}

export default useFlags;
