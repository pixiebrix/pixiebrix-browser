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

import useRequiredPartnerAuth from "@/auth/useRequiredPartnerAuth";
import { uuidv4 } from "@/types/helpers";
import integrationsSlice from "@/integrations/store/integrationsSlice";
import settingsSlice from "@/store/settings/settingsSlice";
import useManagedStorageState from "@/store/enterprise/useManagedStorageState";
import { CONTROL_ROOM_OAUTH_INTEGRATION_ID } from "@/integrations/constants";
import {
  mockAnonymousMeApiResponse,
  mockAuthenticatedMeApiResponse,
} from "@/testUtils/userMock";
import {
  deploymentKeyFactory,
  meApiResponseFactory,
  meOrganizationApiResponseFactory,
  meWithPartnerApiResponseFactory,
  partnerAuthDataFactory,
} from "@/testUtils/factories/authFactories";
import { renderHook } from "@/pageEditor/testHelpers";
import { integrationConfigFactory } from "@/testUtils/factories/integrationFactories";
import { valueToAsyncState } from "@/utils/asyncStateUtils";
import usePartnerAuthData from "@/auth/usePartnerAuthData";
import { Milestones } from "@/data/model/UserMilestone";
import { getDeploymentKey } from "@/auth/deploymentKey";
import { getExtensionToken } from "@/auth/authStorage";
import { waitFor } from "@testing-library/react";

jest.mock("@/store/enterprise/useManagedStorageState");
jest.mock("@/auth/usePartnerAuthData");
jest.mock("@/auth/deploymentKey");
jest.mock("@/auth/authStorage");

const useManagedStorageStateMock = jest.mocked(useManagedStorageState);
const usePartnerAuthDataMock = jest.mocked(usePartnerAuthData);
const getDeploymentKeyMock = jest.mocked(getDeploymentKey);
const getExtensionTokenMock = jest.mocked(getExtensionToken);

beforeEach(() => {
  jest.clearAllMocks();
  // eslint-disable-next-line no-restricted-syntax -- we really do want to resolve to undefined
  getExtensionTokenMock.mockResolvedValue(undefined);
  useManagedStorageStateMock.mockReturnValue(valueToAsyncState({}));

  usePartnerAuthDataMock.mockReturnValue(valueToAsyncState(undefined));
});

describe("useRequiredPartnerAuth", () => {
  test("no partner", async () => {
    await mockAuthenticatedMeApiResponse();

    const { result } = renderHook(() => useRequiredPartnerAuth());

    await waitFor(() => {
      expect(result.current).toStrictEqual({
        hasPartner: false,
        partnerKey: undefined,
        requiresIntegration: false,
        hasConfiguredIntegration: false,
        isLoading: false,
        error: undefined,
      });
    });
  });

  test("require partner via settings screen", async () => {
    await mockAuthenticatedMeApiResponse();

    const { result } = renderHook(() => useRequiredPartnerAuth(), {
      setupRedux(dispatch) {
        dispatch(
          settingsSlice.actions.setAuthMethod({ authMethod: "partner-oauth2" }),
        );
        dispatch(
          settingsSlice.actions.setAuthIntegrationId({
            integrationId: CONTROL_ROOM_OAUTH_INTEGRATION_ID,
          }),
        );
      },
    });

    await waitFor(() => {
      expect(result.current).toStrictEqual({
        hasPartner: false,
        partnerKey: undefined,
        requiresIntegration: true,
        hasConfiguredIntegration: false,
        isLoading: false,
        error: undefined,
      });
    });
  });

  test("requires integration", async () => {
    await mockAuthenticatedMeApiResponse(
      meWithPartnerApiResponseFactory({
        organization: meOrganizationApiResponseFactory({
          control_room: {
            id: uuidv4(),
            url: "https://control-room.example.com",
          },
        }),
      }),
    );

    const { result } = renderHook(() => useRequiredPartnerAuth());

    await waitFor(() => {
      expect(result.current).toStrictEqual({
        hasPartner: true,
        partnerKey: "automation-anywhere",
        requiresIntegration: true,
        hasConfiguredIntegration: false,
        isLoading: false,
        error: undefined,
      });
    });
  });

  test("does not require integration for users authenticated with pixiebrix token", async () => {
    getExtensionTokenMock.mockResolvedValue("mock-token");

    await mockAuthenticatedMeApiResponse(
      meWithPartnerApiResponseFactory({
        organization: meOrganizationApiResponseFactory({
          control_room: {
            id: uuidv4(),
            url: "https://control-room.example.com",
          },
        }),
      }),
    );

    const { result } = renderHook(() => useRequiredPartnerAuth());

    await waitFor(() => {
      expect(result.current).toStrictEqual({
        hasPartner: true,
        partnerKey: "automation-anywhere",
        requiresIntegration: false,
        hasConfiguredIntegration: false,
        isLoading: false,
        error: undefined,
      });
    });
  });

  test("requires integration for managed storage partner", async () => {
    useManagedStorageStateMock.mockReturnValue(
      valueToAsyncState({ partnerId: "automation-anywhere" }),
    );

    mockAnonymousMeApiResponse();

    const { result } = renderHook(() => useRequiredPartnerAuth());

    await waitFor(() => {
      expect(result.current).toStrictEqual({
        hasPartner: true,
        partnerKey: "automation-anywhere",
        requiresIntegration: true,
        hasConfiguredIntegration: false,
        isLoading: false,
        error: undefined,
      });
    });
  });

  test("requires integration for CE user", async () => {
    await mockAuthenticatedMeApiResponse(
      meWithPartnerApiResponseFactory({
        milestones: [{ key: Milestones.AA_COMMUNITY_EDITION_REGISTER }],
      }),
    );

    const { result } = renderHook(() => useRequiredPartnerAuth());

    await waitFor(() => {
      expect(result.current).toStrictEqual({
        hasPartner: true,
        partnerKey: "automation-anywhere",
        requiresIntegration: true,
        hasConfiguredIntegration: false,
        isLoading: false,
        error: undefined,
      });
    });
  });

  test("does not require integration for CE user once partner is removed", async () => {
    await mockAuthenticatedMeApiResponse(
      meApiResponseFactory({
        milestones: [{ key: Milestones.AA_COMMUNITY_EDITION_REGISTER }],
      }),
    );

    const { result } = renderHook(() => useRequiredPartnerAuth());

    await waitFor(() => {
      expect(result.current).toStrictEqual({
        hasPartner: false,
        partnerKey: undefined,
        requiresIntegration: false,
        hasConfiguredIntegration: false,
        isLoading: false,
        error: undefined,
      });
    });
  });

  test("has required partner integration", async () => {
    usePartnerAuthDataMock.mockReturnValue(
      valueToAsyncState(partnerAuthDataFactory()),
    );

    await mockAuthenticatedMeApiResponse(
      meWithPartnerApiResponseFactory({
        organization: meOrganizationApiResponseFactory({
          control_room: {
            id: uuidv4(),
            url: "https://control-room.example.com",
          },
        }),
      }),
    );

    const { result } = renderHook(() => useRequiredPartnerAuth(), {
      setupRedux(dispatch) {
        dispatch(
          integrationsSlice.actions.upsertIntegrationConfig(
            integrationConfigFactory({
              integrationId: CONTROL_ROOM_OAUTH_INTEGRATION_ID,
            }),
          ),
        );
      },
    });

    await waitFor(() => {
      expect(result.current).toStrictEqual({
        hasPartner: true,
        partnerKey: "automation-anywhere",
        requiresIntegration: true,
        hasConfiguredIntegration: true,
        isLoading: false,
        error: undefined,
      });
    });
  });

  test("does not require integration when a deployment key is provided", async () => {
    getDeploymentKeyMock.mockResolvedValue(deploymentKeyFactory());

    await mockAuthenticatedMeApiResponse(
      meWithPartnerApiResponseFactory({
        organization: meOrganizationApiResponseFactory({
          control_room: {
            id: uuidv4(),
            url: "https://control-room.example.com",
          },
        }),
      }),
    );

    const { result } = renderHook(() => useRequiredPartnerAuth());

    await waitFor(() => {
      expect(result.current).toStrictEqual({
        // Partner/there is still set because there's a control room
        hasPartner: true,
        partnerKey: "automation-anywhere",
        requiresIntegration: false,
        hasConfiguredIntegration: false,
        isLoading: false,
        error: undefined,
      });
    });
  });
});
