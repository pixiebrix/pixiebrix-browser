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

import { useGetOrganizationsQuery } from "@/services/api";
import useFlags from "@/hooks/useFlags";
import { type Organization } from "@/types/contract";
import useDeployments from "@/hooks/useDeployments";
import useOnboarding from "@/extensionConsole/pages/blueprints/onboardingView/useOnboarding";
import { renderHook } from "@testing-library/react-hooks";
import { useAllRecipes } from "@/recipes/recipesHooks";

jest.mock("react-redux", () => ({
  useSelector: jest.fn(),
}));

jest.mock("@/services/api", () => ({
  useGetOrganizationsQuery: jest.fn(),
}));

jest.mock("@/hooks/useFlags", () => jest.fn());
jest.mock("@/hooks/useDeployments", () => jest.fn());
jest.mock("@/recipes/recipesHooks", () => ({
  useAllRecipes: jest.fn(),
}));

const mockOnboarding = ({
  hasOrganization = false,
  hasDeployments = false,
  hasTeamBlueprints = false,
  hasRestrictedFlag = false,
}: {
  hasOrganization?: boolean;
  hasDeployments?: boolean;
  hasTeamBlueprints?: boolean;
  hasRestrictedFlag?: boolean;
} = {}) => {
  (useGetOrganizationsQuery as jest.Mock).mockImplementation(() => ({
    data: hasOrganization ? [{} as Organization] : [],
  }));

  // eslint-disable-next-line arrow-body-style -- better readability b/c it's returning a method
  (useDeployments as jest.Mock).mockImplementation(() => {
    return {
      hasUpdate: hasDeployments,
      update() {},
      extensionUpdateRequired: false,
      isLoading: false,
      error: undefined as unknown,
    };
  });

  (useAllRecipes as jest.Mock).mockImplementation(() => ({
    data: hasTeamBlueprints
      ? [
          {
            sharing: {
              organizations: [{} as Organization],
            },
          },
        ]
      : [],
  }));

  (useFlags as jest.Mock).mockImplementation(() => ({
    restrict: () => hasRestrictedFlag,
  }));
};

describe("useOnboarding", () => {
  test("default user", () => {
    mockOnboarding();
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.onboardingType).toBe("default");
  });

  test("restricted enterprise user", () => {
    mockOnboarding({ hasOrganization: true, hasRestrictedFlag: true });
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.onboardingType).toBe("restricted");
  });

  test("unrestricted enterprise user", () => {
    mockOnboarding({ hasOrganization: true });
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.onboardingType).toBe("default");
  });

  test("unrestricted enterprise user with teams", () => {
    mockOnboarding({ hasOrganization: true, hasTeamBlueprints: true });
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.onboardingType).toBe("hasTeamBlueprints");
  });

  test("enterprise user with deployments", () => {
    mockOnboarding({ hasOrganization: true, hasDeployments: true });
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.onboardingType).toBe("hasDeployments");
  });
});
