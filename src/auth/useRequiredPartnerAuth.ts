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

import { useGetMeQuery } from "@/data/service/api";
import { useSelector } from "react-redux";
import { selectAuth } from "@/auth/authSelectors";
import { selectIntegrationConfigs } from "@/integrations/store/integrationsSelectors";
import { selectSettings } from "@/store/settings/settingsSelectors";
import {
  addListener as addAuthListener,
  readPartnerAuthData,
  removeListener as removeAuthListener,
} from "@/auth/authStorage";
import { useCallback, useEffect, useRef } from "react";
import { AUTOMATION_ANYWHERE_PARTNER_KEY } from "@/data/service/constants";
import { type SettingsState } from "@/store/settings/settingsTypes";
import useManagedStorageState from "@/store/enterprise/useManagedStorageState";
import { type RegistryId } from "@/types/registryTypes";
import {
  CONTROL_ROOM_OAUTH_INTEGRATION_ID,
  CONTROL_ROOM_TOKEN_INTEGRATION_ID,
} from "@/integrations/constants";
import useAsyncState from "@/hooks/useAsyncState";
import { type UserPartner } from "@/data/model/UserPartner";
import { type ControlRoom } from "@/data/model/ControlRoom";
import { type UserMilestone } from "@/data/model/UserMilestone";
import { type Nullishable } from "@/utils/nullishUtils";
import { Me } from "@/data/model/Me";

/**
 * Map from partner keys to partner service IDs
 */
const PARTNER_MAP = new Map<string, Set<RegistryId>>([
  [
    AUTOMATION_ANYWHERE_PARTNER_KEY,
    new Set([
      CONTROL_ROOM_TOKEN_INTEGRATION_ID,
      CONTROL_ROOM_OAUTH_INTEGRATION_ID,
    ]),
  ],
]);

type RequiredPartnerState = {
  /**
   * True if the user's is a partner account.
   */
  hasPartner: boolean;

  /**
   * The partner key of the partner, or null if hasPartner is false.
   *
   * @see RequiredPartnerState.hasPartner
   */
  partnerKey: string | null;

  /**
   * True if the user's account is a partner account and must have an integration configured for the partner.
   *
   * @see RequiredPartnerState.hasPartner
   */
  requiresIntegration: boolean;

  /**
   * True if the user's account requires a partner integration configuration, that the user has a configuration
   * for the integration, and that the user has a bearer token for the integration.
   */
  hasConfiguredIntegration: boolean;

  /**
   * True if latest partner information is loading from the PixieBrix server.
   */
  isLoading: boolean;

  /**
   * The error if there was an error loading partner information from the PixieBrix server, or null otherwise.
   */
  error: unknown;
};

function decidePartnerIntegrationIds({
  authIntegrationIdOverride,
  authMethodOverride,
  partnerId,
}: {
  authIntegrationIdOverride: RegistryId | null;
  authMethodOverride: SettingsState["authMethod"];
  partnerId: string | null;
}): Set<RegistryId> {
  if (authIntegrationIdOverride) {
    return new Set<RegistryId>([authIntegrationIdOverride]);
  }

  if (authMethodOverride === "partner-oauth2") {
    return new Set<RegistryId>([CONTROL_ROOM_OAUTH_INTEGRATION_ID]);
  }

  if (authMethodOverride === "partner-token") {
    return new Set<RegistryId>([CONTROL_ROOM_TOKEN_INTEGRATION_ID]);
  }

  return PARTNER_MAP.get(partnerId) ?? new Set();
}

/**
 * Hook for determining if the extension has required integrations for the partner.
 *
 * Covers both:
 * - Integration required, but PixieBrix native token is still used for authentication
 * - Integration required, using partner JWT for authentication
 */
function useRequiredPartnerAuth(): RequiredPartnerState {
  const {
    isUninitialized,
    isLoading,
    isFetching,
    data: me,
    error,
  } = useGetMeQuery(undefined, { refetchOnMountOrArgChange: false });

  // const {
  //   isLoading,
  //   data: me,
  //   error,
  // } = {
  //   isLoading: false,
  //   data: null as Me,
  //   error: null as unknown,
  // }

  const localAuth = useSelector(selectAuth);
  const {
    authIntegrationId: authIntegrationIdOverride,
    authMethod: authMethodOverride,
    partnerId: partnerIdOverride,
  } = useSelector(selectSettings);
  const integrationConfigs = useSelector(selectIntegrationConfigs);

  // Read enterprise managed state
  const { data: managedState = {} } = useManagedStorageState();
  const { controlRoomUrl: managedControlRoomUrl, partnerId: managedPartnerId } =
    managedState;

  // Prefer the latest remote data, but use local data to avoid blocking page load
  let partner: Nullishable<UserPartner> = null;
  let controlRoom: Nullishable<ControlRoom> = null;
  const userMilestones: UserMilestone[] = [];

  if (me) {
    partner = me.partner;
    controlRoom = me.primaryOrganization?.controlRoom ?? null;
    userMilestones.push(...me.userMilestones);
  } else if (localAuth) {
    partner = localAuth.partner;
    controlRoom = localAuth.organization?.control_room ?? null;
    userMilestones.push(...localAuth.milestones);
  }

  const hasControlRoom = controlRoom != null || Boolean(managedControlRoomUrl);
  const isCommunityEditionUser = userMilestones.some(
    ({ milestoneName }) => milestoneName === "aa_community_edition_register",
  );
  const hasPartner =
    Boolean(partner) ||
    Boolean(managedPartnerId) ||
    hasControlRoom ||
    (Boolean(me?.partner) && isCommunityEditionUser);
  const partnerId =
    partnerIdOverride ??
    managedPartnerId ??
    partner?.partnerTheme ??
    (hasControlRoom || isCommunityEditionUser ? "automation-anywhere" : null);

  const partnerIntegrationIds = decidePartnerIntegrationIds({
    authIntegrationIdOverride,
    authMethodOverride,
    partnerId,
  });

  const partnerConfiguration = integrationConfigs.find((integrationConfig) =>
    partnerIntegrationIds.has(integrationConfig.integrationId),
  );

  const getIsMissingPartnerJwt = useCallback<
    () => Promise<boolean>
  >(async () => {
    if (authMethodOverride === "pixiebrix-token") {
      // User forced pixiebrix-token authentication via Advanced Settings > Authentication Method
      return false;
    }

    // Require partner OAuth2 if:
    // - A Control Room URL is configured - on the cached organization or in managed storage
    // - The partner is Automation Anywhere in managed storage. (This is necessary, because the control room URL is
    //   not known at bot agent install time for registry HKLM hive installs)
    // - The user used Advanced Settings > Authentication Method to force partner OAuth2
    if (
      hasControlRoom ||
      managedPartnerId === "automation-anywhere" ||
      authMethodOverride === "partner-oauth2"
    ) {
      // Future improvement: check that the Control Room URL from readPartnerAuthData matches the expected
      // Control Room URL
      const { token: partnerToken } = await readPartnerAuthData();
      return partnerToken == null;
    }

    return false;
  }, [authMethodOverride, hasControlRoom, managedPartnerId]);

  // WARNING: the logic in this method must match the logic in usePartnerLoginMode
  // `_` prefix so lint doesn't yell for unused variables in the destructuring
  const { data: isMissingPartnerJwt, refetch: refreshPartnerJwtState } =
    useAsyncState(getIsMissingPartnerJwt, [getIsMissingPartnerJwt]);

  useEffect(() => {
    // Listen for token invalidation
    const handler = async () => {
      console.debug("Auth state changed, checking for token");
      refreshPartnerJwtState();
    };

    addAuthListener(handler);

    return () => {
      removeAuthListener(handler);
    };
  }, [refreshPartnerJwtState]);

  const requiresIntegration =
    // Primary organization has a partner and linked control room
    (hasPartner && controlRoom != null) ||
    // Partner Automation Anywhere is configured in managed storage (e.g., set by Bot Agent installer)
    managedPartnerId === "automation-anywhere" ||
    // Community edition users are required to be linked until they join an organization
    (me?.partner && isCommunityEditionUser) ||
    // User has overridden local settings
    authMethodOverride === "partner-oauth2" ||
    authMethodOverride === "partner-token";

  console.log("*** render useRequiredPartnerAuth", {
    integrationConfigs,
    authMethodOverride,
    hasPartner,
    partner,
    managedPartnerId,
    hasControlRoom,
    mePartner: me?.partner,
    isUninitialized,
    isLoading,
    isFetching,
    error,
    isCommunityEditionUser,
  });

  if (authMethodOverride === "pixiebrix-token") {
    // User forced pixiebrix-token authentication via Advanced Settings > Authentication Method. Keep the theme,
    // if any, but don't require a partner integration configuration.
    return {
      hasPartner,
      partnerKey: partner?.partnerTheme,
      requiresIntegration: false,
      hasConfiguredIntegration: false,
      isLoading: false,
      error: undefined,
    };
  }

  return {
    hasPartner,
    partnerKey: partner?.partnerTheme ?? managedPartnerId,
    requiresIntegration,
    hasConfiguredIntegration:
      requiresIntegration &&
      Boolean(partnerConfiguration) &&
      !isMissingPartnerJwt,
    isLoading,
    error,
  };
}

export default useRequiredPartnerAuth;
