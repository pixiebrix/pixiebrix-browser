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

import React from "react";
import { render } from "@/extensionConsole/testHelpers";
import ModPageLayout from "@/extensionConsole/pages/mods/ModPageLayout";
import { type Mod } from "@/mods/modTypes";
import { waitForEffect } from "@/testUtils/testHelpers";
import { act, screen } from "@testing-library/react";
import modsSlice from "@/extensionConsole/pages/mods/modsSlice";
import userEvent from "@testing-library/user-event";
import { authSlice } from "@/auth/authSlice";
import { mockCachedUser, mockLoadingUser } from "@/testUtils/userMock";
import { appApiMock, onDeferredGet } from "@/testUtils/appApiMock";
import {
  authStateFactory,
  userFactory,
  userOrganizationFactory,
} from "@/testUtils/factories/authFactories";

jest.mock("@/recipes/recipesHooks", () => ({
  useAllRecipes: jest
    .fn()
    .mockReturnValue({ data: [], isFetchingFromCache: false }),
  useOptionalRecipe: jest
    .fn()
    .mockReturnValue({ data: [], isFetchingFromCache: false }),
}));

const installables: Mod[] = [];

describe("BlueprintsPageLayout", () => {
  const { env } = process;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...env };
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    process.env = env;
    jest.runAllTimers();
    jest.useRealTimers();
  });

  test("renders", async () => {
    const rendered = render(<ModPageLayout mods={installables} />);
    await waitForEffect();
    expect(rendered.asFragment()).toMatchSnapshot();
  });

  test("doesn't flash the 'Get Started' tab while loading", async () => {
    appApiMock.reset();

    const deferred = onDeferredGet("/api/onboarding/starter-blueprints/");

    render(<ModPageLayout mods={installables} />);
    await waitForEffect();
    expect(
      screen.queryByText("Welcome to the PixieBrix Extension Console")
    ).toBeNull();
    expect(screen.queryByText("Get Started")).toBeNull();

    deferred.resolve([]);

    await waitForEffect();
    expect(
      screen.queryByText("Welcome to the PixieBrix Extension Console")
    ).not.toBeNull();
    expect(screen.queryByText("Get Started")).not.toBeNull();
  });

  test("get started tab is active by default", async () => {
    render(<ModPageLayout mods={installables} />);
    await waitForEffect();
    expect(
      screen.queryByText("Welcome to the PixieBrix Extension Console")
    ).not.toBeNull();
    expect(screen.queryByText("Get Started")).not.toBeNull();
    expect(screen.getByTestId("get-started-blueprint-tab")).toHaveClass(
      "active"
    );
  });

  test("does not show 'Get Started' tab for enterprise users", async () => {
    mockCachedUser(
      userFactory({
        organization: userOrganizationFactory(),
      })
    );
    render(<ModPageLayout mods={installables} />);
    await waitForEffect();
    expect(
      screen.queryByText("Welcome to the PixieBrix Extension Console")
    ).toBeNull();
    expect(screen.queryByText("Get Started")).toBeNull();
  });

  test("shows the bot games tab", async () => {
    mockCachedUser();

    render(<ModPageLayout mods={installables} />, {
      setupRedux(dispatch) {
        dispatch(
          authSlice.actions.setAuth(
            authStateFactory({
              flags: ["bot-games-event-in-progress"],
              milestones: [{ key: "bot_games_2022_register" }],
            })
          )
        );
      },
    });
    await waitForEffect();
    expect(screen.getByText("Bot Games")).not.toBeNull();
    expect(screen.queryByText("Get Started")).toBeNull();
  });

  test("doesn't flash get started tab while loading the bot games tab", async () => {
    mockLoadingUser();

    render(<ModPageLayout mods={installables} />);
    await waitForEffect();
    expect(screen.queryByText("Get Started")).toBeNull();

    render(<ModPageLayout mods={installables} />, {
      setupRedux(dispatch) {
        dispatch(
          authSlice.actions.setAuth(
            authStateFactory({
              flags: ["bot-games-event-in-progress"],
              milestones: [{ key: "bot_games_2022_register" }],
            })
          )
        );
      },
    });
    await waitForEffect();
    expect(screen.getByText("Bot Games")).not.toBeNull();
    expect(screen.queryByText("Get Started")).toBeNull();
  });

  test("bot games tab is active by default", async () => {
    render(<ModPageLayout mods={installables} />, {
      setupRedux(dispatch) {
        dispatch(
          authSlice.actions.setAuth(
            authStateFactory({
              flags: ["bot-games-event-in-progress"],
              milestones: [{ key: "bot_games_2022_register" }],
            })
          )
        );
      },
    });
    await waitForEffect();
    expect(screen.queryByText("Bot Games")).not.toBeNull();
    expect(screen.getByTestId("bot-games-blueprint-tab")).toHaveClass("active");
  });

  test("search query heading renders", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<ModPageLayout mods={installables} />);

    await waitForEffect();

    await user.type(
      screen.getByTestId("blueprints-search-input"),
      "hello world"
    );
    act(() => {
      jest.runAllTimers();
    });
    expect(screen.queryByText('0 results for "hello world"')).not.toBeNull();

    await user.type(
      screen.getByTestId("blueprints-search-input"),
      " hello world again!"
    );
    act(() => {
      jest.runAllTimers();
    });
    expect(
      screen.queryByText('0 results for "hello world hello world again!"')
    ).not.toBeNull();
  });
});

describe("Serializable Data Test", () => {
  test("Pushes unserializable data to redux", async () => {
    const spy = jest.spyOn(console, "error");
    render(<ModPageLayout mods={installables} />, {
      setupRedux(dispatch) {
        dispatch(
          modsSlice.actions.setSearchQuery((() => {}) as unknown as string)
        );
      },
    });

    await waitForEffect();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("A non-serializable value was detected"),
      expect.toBeFunction(),
      expect.toBeString()
    );
  });
});
