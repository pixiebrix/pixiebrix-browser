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

import { render, act, screen } from "@testing-library/react";

import {
  QUICKBAR_EVENT_NAME,
  QuickBarApp,
} from "@/components/quickBar/QuickBarApp";
import React from "react";
import { mockAnimationsApi } from "jsdom-testing-mocks";
import selectionController from "@/utils/selectionController";
import userEvent from "@testing-library/user-event";
import quickBarRegistry from "@/components/quickBar/quickBarRegistry";
import { type ActionGenerator } from "@/components/quickBar/quickbarTypes";

// Could alternatively mock the internal calls, but this is easier if we trust the component
jest.mock("@/components/Stylesheets", () => ({
  __esModule: true,
  Stylesheets({ children }: any) {
    return <>{children}</>;
  },
}));

jest.mock("kbar", () => {
  const originalModule = jest.requireActual("kbar");
  return {
    ...originalModule,
    // KBarAnimator trouble with animations/mockAnimationsApi
    KBarAnimator: jest
      .fn()
      .mockImplementation((props) => <>{props.children}</>),
  };
});

jest.mock("@/utils/selectionController", () => ({
  __esModule: true,
  default: {
    save: jest.fn(),
    restore: jest.fn(),
    get: jest.fn(),
  },
}));

// TODO: fix tests so they properly handle shadow dom events
jest.mock("react-shadow/emotion", () => ({
  __esModule: true,
  default: {
    div(props: any) {
      return <div {...props}></div>;
    },
  },
}));

const saveSelectionMock = selectionController.save as jest.MockedFunction<
  typeof selectionController.save
>;

mockAnimationsApi();

// Running all pending timers and switching to real timers using Jest
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

beforeEach(() => {
  jest.useFakeTimers();
});

describe("QuickBarApp", () => {
  beforeEach(() => {
    saveSelectionMock.mockClear();
  });

  it("should render nothing when not toggled", () => {
    render(<QuickBarApp />);

    expect(screen.queryByTestId("quickBar")).not.toBeInTheDocument();
    expect(document.body.outerHTML).toMatchSnapshot();
  });

  // This test is flakey due (aria-expanded). Maybe a timer issue?
  it.skip("should render toggled", async () => {
    render(<QuickBarApp />);

    await act(async () => {
      window.dispatchEvent(new Event(QUICKBAR_EVENT_NAME));

      // Fast-forward until all timers have been executed. Can't use runOnlyPendingTimers because the there must be
      // a setInterval/etc. to get the quick bar into a fully initialized state
      jest.advanceTimersByTime(2000);
    });

    // Snapshotting is flakey due to animation (aria-expanded)
    expect(document.body.outerHTML).toMatchSnapshot();
    expect(screen.getByTestId("quickBar")).toBeVisible();
    expect(screen.getByRole("combobox")).toBeVisible();
  });

  it("should preserve selection information when typing", async () => {
    // Avoid timeout when using useFakeTimers: https://github.com/testing-library/user-event/issues/833
    const user = userEvent.setup({ delay: null });

    render(<QuickBarApp />);

    await act(async () => {
      window.dispatchEvent(new Event(QUICKBAR_EVENT_NAME));

      // Fast-forward until all timers have been executed. Can't use runOnlyPendingTimers because the there must be
      // a setInterval/etc. to get the quick bar into a fully initialized state
      jest.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId("quickBar")).toBeVisible();
    expect(screen.getByRole("combobox")).toBeVisible();
    expect(saveSelectionMock).toHaveBeenCalledOnce();

    await act(async () => {
      await user.type(screen.getByRole("combobox"), "test");

      // Fast-forward until all timers have been executed
      jest.advanceTimersByTime(2000);
    });

    expect(saveSelectionMock).toHaveBeenCalledOnce();
  });

  it("debounces action generation on typing", async () => {
    const user = userEvent.setup({ delay: null });
    const generatorMock: ActionGenerator = jest
      .fn()
      .mockResolvedValue(undefined);
    quickBarRegistry.addGenerator(generatorMock, null);

    render(<QuickBarApp />);

    await act(async () => {
      window.dispatchEvent(new Event(QUICKBAR_EVENT_NAME));
    });

    // Runs on mount
    expect(generatorMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await user.type(screen.getByRole("combobox"), "test");

      // Fast-forward until all timers have been executed
      jest.advanceTimersByTime(100);
    });

    expect(generatorMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      // Fast-forward until all timers have been executed
      jest.advanceTimersByTime(2000);
    });

    expect(generatorMock).toHaveBeenCalledTimes(2);

    quickBarRegistry.removeGenerator(generatorMock);
  });
});
