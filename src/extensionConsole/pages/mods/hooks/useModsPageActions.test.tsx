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

/* eslint-disable jest/expect-expect -- assertions in expectActions helper function */
/// <reference types="jest-extended" />

import useModsPageActions, {
  type ModsPageActions,
} from "@/extensionConsole/pages/mods/hooks/useModsPageActions";
import useFlags from "@/hooks/useFlags";
import {
  type ModStatus,
  type ModViewItem,
  type SharingType,
} from "@/types/modTypes";
import useModPermissions from "@/mods/hooks/useModPermissions";
import { uniq } from "lodash";
import { uuidv4 } from "@/types/helpers";
import { uninstallExtensions, uninstallRecipe } from "@/store/uninstallUtils";
import { renderHook } from "@/extensionConsole/testHelpers";
import { actions as extensionActions } from "@/store/extensionsSlice";
import { type ModDefinition } from "@/types/modDefinitionTypes";
import { type ModComponentBase } from "@/types/extensionTypes";
import {
  cloudExtensionFactory,
  extensionFactory,
} from "@/testUtils/factories/extensionFactories";
import { recipeFactory } from "@/testUtils/factories/recipeFactories";

jest.mock("@/hooks/useFlags", () => jest.fn());
jest.mock("@/mods/hooks/useModPermissions", () => jest.fn());

const expectActions = (
  expectedActions: string[],
  actualActions: ModsPageActions
) => {
  // Union both set of keys to ensure all possible keys are covered
  const allActions = uniq([...Object.keys(actualActions), ...expectedActions]);
  const expected = Object.fromEntries(
    allActions.map((action) => [
      action,
      expectedActions.includes(action)
        ? expect.not.toBeNil()
        : expect.toBeNil(),
    ])
  );
  expect(actualActions).toStrictEqual(expected);
};

const mockHooks = ({
  restricted = false,
  hasPermissions = true,
}: { restricted?: boolean; hasPermissions?: boolean } = {}) => {
  (useFlags as jest.Mock).mockImplementation(() => ({
    permit: () => !restricted,
    restrict: () => restricted,
  }));

  (useModPermissions as jest.Mock).mockImplementation(() => ({
    hasPermissions,
    requestPermissions() {},
  }));
};

const modViewItemFactory = ({
  isExtension,
  sharingType,
  status,
  unavailable = false,
}: {
  isExtension: boolean;
  sharingType: SharingType;
  status: ModStatus;
  unavailable?: boolean;
}) =>
  ({
    mod: isExtension ? extensionFactory() : recipeFactory(),
    sharing: {
      source: {
        type: sharingType,
      },
    },
    status,
    unavailable,
  } as ModViewItem);

afterEach(() => {
  jest.resetAllMocks();
});

describe("useModsPageActions", () => {
  test("cloud extension", () => {
    mockHooks();
    const cloudExtensionItem = modViewItemFactory({
      isExtension: true,
      sharingType: "Personal",
      status: "Inactive",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useModsPageActions(cloudExtensionItem));
    expectActions(
      ["viewPublish", "viewShare", "activate", "deleteExtension"],
      actions
    );
  });

  test("active personal extension", () => {
    mockHooks();
    const personalExtensionItem = modViewItemFactory({
      isExtension: true,
      sharingType: "Personal",
      status: "Active",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useModsPageActions(personalExtensionItem));
    expectActions(
      ["viewPublish", "viewShare", "deactivate", "viewLogs"],
      actions
    );
  });

  test("active personal blueprint", () => {
    mockHooks();
    const personalBlueprintItem = modViewItemFactory({
      isExtension: false,
      sharingType: "Personal",
      status: "Active",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useModsPageActions(personalBlueprintItem));
    expectActions(
      ["viewPublish", "viewShare", "deactivate", "viewLogs", "reactivate"],
      actions
    );
  });

  test("inactive personal blueprint", () => {
    mockHooks();
    const personalBlueprintItem = modViewItemFactory({
      isExtension: false,
      sharingType: "Personal",
      status: "Inactive",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useModsPageActions(personalBlueprintItem));
    expectActions(["viewPublish", "viewShare", "activate"], actions);
  });

  test("active team blueprint", () => {
    mockHooks();
    const teamBlueprintItem = modViewItemFactory({
      isExtension: false,
      sharingType: "Team",
      status: "Active",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useModsPageActions(teamBlueprintItem));
    expectActions(
      ["viewPublish", "viewShare", "deactivate", "viewLogs", "reactivate"],
      actions
    );
  });

  test("inactive team blueprint", () => {
    mockHooks();
    const teamBlueprintItem = modViewItemFactory({
      isExtension: false,
      sharingType: "Team",
      status: "Inactive",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useModsPageActions(teamBlueprintItem));
    expectActions(["viewPublish", "viewShare", "activate"], actions);
  });

  test("public blueprint", () => {
    mockHooks();
    const publicBlueprintItem = modViewItemFactory({
      isExtension: false,
      sharingType: "Personal",
      status: "Active",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useModsPageActions(publicBlueprintItem));
    expectActions(
      ["viewPublish", "viewShare", "reactivate", "viewLogs", "deactivate"],
      actions
    );
  });

  test("team deployment for unrestricted user", () => {
    mockHooks({ restricted: false });
    const deploymentItem = modViewItemFactory({
      isExtension: false,
      sharingType: "Deployment",
      status: "Active",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useModsPageActions(deploymentItem));
    expectActions(["reactivate", "deactivate", "viewLogs"], actions);
  });

  test("restricted team deployment", () => {
    mockHooks({ restricted: true });
    const deploymentItem = modViewItemFactory({
      isExtension: false,
      sharingType: "Deployment",
      status: "Active",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useModsPageActions(deploymentItem));
    expectActions(["viewLogs"], actions);
  });

  test("blueprint with missing permissions", () => {
    mockHooks({ hasPermissions: false });
    const deploymentItem = modViewItemFactory({
      isExtension: false,
      sharingType: "Team",
      status: "Active",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useModsPageActions(deploymentItem));
    expectActions(
      [
        "viewPublish",
        "viewShare",
        "deactivate",
        "viewLogs",
        "requestPermissions",
        "reactivate",
      ],
      actions
    );
  });

  test("blueprint with access revoked", () => {
    mockHooks();
    const blueprintItem = modViewItemFactory({
      isExtension: false,
      sharingType: "Team",
      status: "Active",
      unavailable: true,
    });

    const {
      result: { current: actions },
    } = renderHook(() => useModsPageActions(blueprintItem));
    expectActions(["deactivate", "viewLogs"], actions);
  });

  test("paused deployment with unrestricted user", () => {
    mockHooks({ restricted: false });
    const deploymentItem = modViewItemFactory({
      isExtension: false,
      sharingType: "Deployment",
      status: "Paused",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useModsPageActions(deploymentItem));

    // Unrestricted users (e.g., developers) need to be able to deactivate/reactivate a deployment to use a later
    // version of the blueprint for development/testing.
    expectActions(["viewLogs", "deactivate", "reactivate"], actions);
  });

  test("paused deployment with restricted user", () => {
    mockHooks({ restricted: true });
    const deploymentItem = modViewItemFactory({
      isExtension: false,
      sharingType: "Deployment",
      status: "Paused",
    });

    const {
      result: { current: actions },
    } = renderHook(() => useModsPageActions(deploymentItem));

    expectActions(["viewLogs"], actions);
  });

  describe("public blueprint", () => {
    let blueprintItem: ModViewItem;
    beforeEach(() => {
      mockHooks();

      blueprintItem = {
        mod: recipeFactory({
          sharing: { public: true, organizations: [] },
        }),
        sharing: {
          source: {
            type: "Personal",
          },
        },
        status: "Active",
      } as ModViewItem;
    });

    test("pending publish", () => {
      const {
        result: { current: actions },
      } = renderHook(() => useModsPageActions(blueprintItem));
      expectActions(
        ["viewPublish", "viewShare", "deactivate", "viewLogs", "reactivate"],
        actions
      );
    });

    test("published", () => {
      blueprintItem.sharing.listingId = uuidv4();

      const {
        result: { current: actions },
      } = renderHook(() => useModsPageActions(blueprintItem));
      expectActions(
        [
          "viewInMarketplaceHref",
          "viewShare",
          "deactivate",
          "viewLogs",
          "reactivate",
        ],
        actions
      );
    });
  });
});

describe("actions", () => {
  describe("uninstall", () => {
    beforeEach(() => {
      mockHooks();
    });

    test("calls uninstallRecipe for a blueprint", () => {
      mockHooks();
      const modViewItem = modViewItemFactory({
        isExtension: false,
        sharingType: "Personal",
        status: "Active",
      });

      const {
        result: {
          current: { deactivate },
        },
      } = renderHook(() => useModsPageActions(modViewItem));

      deactivate();

      expect(uninstallRecipe).toHaveBeenCalledWith(
        (modViewItem.mod as ModDefinition).metadata.id,
        expect.any(Array),
        expect.any(Function)
      );
      expect(uninstallExtensions).not.toHaveBeenCalled();
    });

    test("calls uninstallExtensions for an extension", () => {
      mockHooks();

      const extension = cloudExtensionFactory();

      const modViewItem = modViewItemFactory({
        isExtension: true,
        sharingType: "Personal",
        status: "Active",
      });
      (modViewItem.mod as ModComponentBase).id = extension.id;

      const {
        result: {
          current: { deactivate },
        },
      } = renderHook(() => useModsPageActions(modViewItem), {
        setupRedux(dispatch) {
          dispatch(extensionActions.installCloudExtension({ extension }));
          dispatch(
            extensionActions.installCloudExtension({
              extension: cloudExtensionFactory(),
            })
          );
        },
      });

      deactivate();

      expect(uninstallRecipe).not.toHaveBeenCalled();
      expect(uninstallExtensions).toHaveBeenCalledWith(
        [extension.id],
        expect.any(Function)
      );
    });
  });
});
