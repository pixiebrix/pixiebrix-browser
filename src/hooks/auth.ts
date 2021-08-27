/*
 * Copyright (C) 2021 PixieBrix, Inc.
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

import { fetch } from "@/hooks/fetch";
import { AuthState, RawServiceConfiguration } from "@/core";
import { updateAuth as updateRollbarAuth } from "@/telemetry/rollbar";
import { getUID } from "@/background/telemetry";
import { AuthOption } from "@/auth/authTypes";
import { useAsyncState } from "./common";
import { readRawConfigurations } from "@/services/registry";
import { SanitizedAuth } from "@/types/contract";
import { useMemo, useCallback } from "react";
import useFetch from "./useFetch";

interface OrganizationResponse {
  readonly id: string;
  readonly name: string;
  readonly scope: string;
}

interface ProfileResponse {
  readonly id: string;
  readonly email: string;
  readonly scope: string | null;
  readonly is_onboarded: boolean;
  readonly organization: OrganizationResponse | null;
  readonly telemetry_organization: OrganizationResponse | null;
  readonly flags: string[];
}

export const anonAuth: AuthState = {
  userId: undefined,
  email: undefined,
  isLoggedIn: false,
  isOnboarded: false,
  extension: true,
  scope: null,
  flags: [],
};

export async function getAuth(): Promise<AuthState> {
  const {
    id,
    email,
    scope,
    organization,
    telemetry_organization: telemetryOrganization,
    is_onboarded: isOnboarded,
    flags = [],
  } = await fetch<ProfileResponse>("/api/me/");
  if (id) {
    await updateRollbarAuth({
      userId: id,
      email,
      organizationId: telemetryOrganization?.id ?? organization?.id,
      browserId: await getUID(),
    });
    return {
      userId: id,
      email,
      scope,
      organization,
      isOnboarded,
      isLoggedIn: true,
      extension: true,
      flags,
    };
  }

  return anonAuth;
}

function defaultLabel(label: string): string {
  const normalized = (label ?? "").trim();
  return normalized === "" ? "Default" : normalized;
}

export function useAuthOptions(): [AuthOption[], () => Promise<void>] {
  const [
    configuredServices,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- clarify which state values ignoring for now
    _localLoading,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- clarify which state values ignoring for now
    _localError,
    refreshLocal,
  ] = useAsyncState<RawServiceConfiguration[]>(readRawConfigurations);

  const { data: remoteAuths, refresh: refreshRemote } = useFetch<
    SanitizedAuth[]
  >("/api/services/shared/?meta=1");

  const authOptions = useMemo(() => {
    const localOptions = (configuredServices ?? []).map((x) => ({
      value: x.id,
      label: `${defaultLabel(x.label)} — Private`,
      local: true,
      serviceId: x.serviceId,
    }));

    const sharedOptions = (remoteAuths ?? []).map((x) => ({
      value: x.id,
      label: `${defaultLabel(x.label)} — ${
        x.organization?.name ?? "✨ Built-in"
      }`,
      local: false,
      serviceId: x.service.config.metadata.id,
    }));

    return [...localOptions, ...sharedOptions];
  }, [remoteAuths, configuredServices]);

  const refresh = useCallback(async () => {
    await Promise.all([refreshRemote(), refreshLocal()]);
  }, [refreshRemote, refreshLocal]);

  return [authOptions, refresh];
}
