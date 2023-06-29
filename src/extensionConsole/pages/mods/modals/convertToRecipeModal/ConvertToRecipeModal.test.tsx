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

import { anonAuth } from "@/auth/authConstants";
import { authSlice } from "@/auth/authSlice";
import { render } from "@/extensionConsole/testHelpers";
import extensionsSlice from "@/store/extensionsSlice";
import userEvent from "@testing-library/user-event";
import React from "react";
import { modModalsSlice } from "@/extensionConsole/pages/mods/modals/modModalsSlice";
import ConvertToRecipeModal from "./ConvertToRecipeModal";
import * as api from "@/services/api";
import {
  selectModalsContext,
  selectShowShareContext,
} from "@/extensionConsole/pages/mods/modals/modModalsSelectors";
import { type RootState } from "@/store/optionsStore";
import { authStateFactory } from "@/testUtils/factories/authFactories";
import { cloudExtensionFactory } from "@/testUtils/factories/extensionFactories";

jest.mock("@/recipes/recipesHooks", () => ({
  useAllRecipes: jest.fn().mockReturnValue({ refetch: jest.fn() }),
}));

jest.mock("@/services/api", () => {
  const originalModule = jest.requireActual("@/services/api");
  return {
    ...originalModule,
    useGetAllCloudExtensionsQuery: jest.fn(),
    useCreateRecipeMutation: jest.fn(),
    useDeleteCloudExtensionMutation: jest.fn(),
  };
});

beforeEach(() => {
  (api.useGetAllCloudExtensionsQuery as jest.Mock).mockReturnValue({
    data: [],
  });
  (api.useCreateRecipeMutation as jest.Mock).mockReturnValue([jest.fn()]);
  (api.useDeleteCloudExtensionMutation as jest.Mock).mockReturnValue([
    jest.fn(),
  ]);
});
afterEach(() => {
  jest.clearAllMocks();
});

describe("it renders", () => {
  test("default state", () => {
    const extension = cloudExtensionFactory();

    const rendered = render(<ConvertToRecipeModal />, {
      setupRedux(dispatch) {
        dispatch(authSlice.actions.setAuth(authStateFactory()));
        dispatch(
          extensionsSlice.actions.installCloudExtension({
            extension,
          })
        );
        dispatch(
          modModalsSlice.actions.setShareContext({
            extensionId: extension.id,
          })
        );
      },
    });

    const dialogRoot = rendered.getByRole("dialog");
    expect(dialogRoot).toMatchSnapshot();
  });

  test("requires user scope", async () => {
    const extension = cloudExtensionFactory();

    const rendered = render(<ConvertToRecipeModal />, {
      setupRedux(dispatch) {
        dispatch(authSlice.actions.setAuth(anonAuth));
        dispatch(
          extensionsSlice.actions.installCloudExtension({
            extension,
          })
        );
        dispatch(
          modModalsSlice.actions.setShareContext({
            extensionId: extension.id,
          })
        );
      },
    });

    // Scope input field is on the screen
    const scopeInput = await rendered.findAllByLabelText("Account Alias");
    expect(scopeInput).not.toBeNull();

    // Screen matches the snapshot
    const dialogRoot = rendered.getByRole("dialog");
    expect(dialogRoot).toMatchSnapshot();
  });

  test.each([
    {
      name: "Share",
      sharingAction: modModalsSlice.actions.setShareContext,
      contextToBeEmpty: "showPublishContext",
      sharingContext: "showShareContext",
    },
    {
      name: "Publish",
      sharingAction: modModalsSlice.actions.setPublishContext,
      contextToBeEmpty: "showShareContext",
      sharingContext: "showPublishContext",
    },
  ] as const)(
    "opens $name modal after converting extension to blueprint",
    async ({ sharingAction, contextToBeEmpty, sharingContext }) => {
      (api.useCreateRecipeMutation as jest.Mock).mockReturnValue([
        jest.fn().mockReturnValue({
          unwrap: jest.fn().mockResolvedValue({
            public: false,
            organizations: [],
            updated_at: new Date().toISOString(),
          }),
        }),
      ]);

      const extension = cloudExtensionFactory();

      const rendered = render(
        <div>
          <ConvertToRecipeModal />
        </div>,
        {
          setupRedux(dispatch) {
            dispatch(authSlice.actions.setAuth(authStateFactory()));
            dispatch(
              extensionsSlice.actions.installCloudExtension({
                extension,
              })
            );
            dispatch(
              sharingAction({
                extensionId: extension.id,
              })
            );
          },
        }
      );

      const submit = await rendered.findByRole("button", {
        name: "Save and Continue",
      });
      await userEvent.click(submit);

      const modalState = selectModalsContext(
        rendered.getReduxStore().getState() as RootState
      );

      expect(modalState[contextToBeEmpty]).toBeNull();
      expect(modalState[sharingContext].extensionId).toBeUndefined();
      expect(modalState[sharingContext].blueprintId).not.toBeUndefined();
    }
  );

  test("converts cloud extension", async () => {
    const extension = cloudExtensionFactory();

    (api.useGetAllCloudExtensionsQuery as jest.Mock).mockReturnValue({
      data: [extension],
    });
    (api.useCreateRecipeMutation as jest.Mock).mockReturnValue([
      jest.fn().mockReturnValue({ unwrap: jest.fn().mockResolvedValue({}) }),
    ]);
    const deleteCloudExtensionMock = jest
      .fn()
      .mockReturnValue({ unwrap: jest.fn().mockResolvedValue({}) });

    (api.useDeleteCloudExtensionMutation as jest.Mock).mockReturnValue([
      deleteCloudExtensionMock,
    ]);

    const rendered = render(<ConvertToRecipeModal />, {
      setupRedux(dispatch) {
        dispatch(authSlice.actions.setAuth(authStateFactory()));
        dispatch(
          modModalsSlice.actions.setShareContext({
            extensionId: extension.id,
          })
        );
      },
    });

    const submit = await rendered.findByRole("button", {
      name: "Save and Continue",
    });
    await userEvent.click(submit);

    // The Cloud extension is deleted
    expect(deleteCloudExtensionMock).toHaveBeenCalled();

    const showShareContext = selectShowShareContext(
      rendered.getReduxStore().getState() as RootState
    );

    expect(showShareContext.extensionId).toBeUndefined();
    expect(showShareContext.blueprintId).not.toBeUndefined();
  });
});
