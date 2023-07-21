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

import { render } from "@/pageEditor/testHelpers";
import React from "react";
import SheetsFileWidget from "@/contrib/google/sheets/ui/SheetsFileWidget";
import { BASE_SHEET_SCHEMA } from "@/contrib/google/sheets/core/schemas";
import { waitForEffect } from "@/testUtils/testHelpers";
import { sheets } from "@/background/messenger/api";
import { makeVariableExpression } from "@/runtime/expressionCreators";
import { validateRegistryId } from "@/types/helpers";
import { type OutputKey } from "@/types/runtimeTypes";
import { uuidSequence } from "@/testUtils/factories/stringFactories";
import { formStateFactory } from "@/testUtils/factories/pageEditorFactories";
import { brickConfigFactory } from "@/testUtils/factories/brickFactories";
import {
  isGAPISupported,
  isGoogleInitialized,
} from "@/contrib/google/initGoogle";
import userEvent from "@testing-library/user-event";
import useGoogleSpreadsheetPicker from "@/contrib/google/sheets/ui/useGoogleSpreadsheetPicker";
import { act, screen } from "@testing-library/react";

jest.mock("@/contrib/google/sheets/ui/useGoogleSpreadsheetPicker", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    showPicker: jest.fn(),
    ensureSheetsTokenAction: jest.fn(),
    hasRejectedPermissions: false,
  })),
}));

jest.mock("@/contrib/google/initGoogle", () => ({
  __esModule: true,
  isGoogleInitialized: jest.fn().mockReturnValue(true),
  isGAPISupported: jest.fn().mockReturnValue(true),
  subscribe: jest.fn(() => () => {}),
}));

jest.mock("@/background/messenger/api", () => ({
  sheets: {
    getSheetProperties: jest
      .fn()
      .mockRejectedValue(new Error("Not implemented")),
  },
}));

const useGoogleSpreadsheetPickerMock = jest.mocked(useGoogleSpreadsheetPicker);
const getSheetPropertiesMock = jest.mocked(sheets.getSheetProperties);
const isGoogleInitializedMock = jest.mocked(isGoogleInitialized);
const isGAPISupportedMock = jest.mocked(isGAPISupported);

describe("SheetsFileWidget", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isGoogleInitializedMock.mockReturnValue(true);
    isGAPISupportedMock.mockReturnValue(true);
  });

  it("smoke test", async () => {
    const rendered = render(
      <SheetsFileWidget name="spreadsheetId" schema={BASE_SHEET_SCHEMA} />,
      {
        initialValues: { spreadsheetId: null },
      }
    );

    await waitForEffect();

    expect(rendered.asFragment()).toMatchSnapshot();
  });

  it("requires gapi", async () => {
    isGoogleInitializedMock.mockReturnValue(false);

    render(
      <SheetsFileWidget name="spreadsheetId" schema={BASE_SHEET_SCHEMA} />,
      {
        initialValues: { spreadsheetId: null },
      }
    );

    await waitForEffect();

    expect(
      screen.getByText(
        "The Google API is not initialized. Please click the button to initialize it."
      )
    ).toBeVisible();
  });

  it("requires gapi support", async () => {
    isGAPISupportedMock.mockReturnValue(false);

    render(
      <SheetsFileWidget name="spreadsheetId" schema={BASE_SHEET_SCHEMA} />,
      {
        initialValues: { spreadsheetId: null },
      }
    );

    await waitForEffect();

    // Text provided by the requireGoogleHOC
    expect(
      screen.getByText(
        "The Google API is not supported in this browser. Please use Google Chrome."
      )
    ).toBeVisible();
  });

  it("selects from file picker", async () => {
    const showPickerMock = jest.fn().mockResolvedValue({
      id: "abc123",
      name: "Test Sheet",
    });

    getSheetPropertiesMock.mockResolvedValue({
      title: "Test Sheet",
    });

    useGoogleSpreadsheetPickerMock.mockReturnValue({
      showPicker: showPickerMock,
      hasRejectedPermissions: false,
      ensureSheetsTokenAction: jest.fn(),
    });

    const rendered = render(
      <SheetsFileWidget name="spreadsheetId" schema={BASE_SHEET_SCHEMA} />,
      {
        initialValues: { spreadsheetId: null },
      }
    );

    await waitForEffect();

    await act(async () => {
      await userEvent.click(screen.getByText("Select"));
    });

    // Verify the widget fetches the information for the selected sheet to re-verify access to the sheet via the API
    expect(getSheetPropertiesMock).toHaveBeenCalledOnce();

    expect(rendered.asFragment()).toMatchSnapshot();
  });

  it("renders valid sheet on load", async () => {
    getSheetPropertiesMock.mockResolvedValue({
      title: "Test Sheet",
    });

    render(
      <SheetsFileWidget name="spreadsheetId" schema={BASE_SHEET_SCHEMA} />,
      {
        initialValues: { spreadsheetId: "abc123" },
      }
    );

    await waitForEffect();

    // Verify it's showing the sheet title and not the sheet unique id
    expect(screen.getByRole("textbox")).toHaveDisplayValue("Test Sheet");
  });

  it("falls back to spreadsheet id if fetching properties fails", async () => {
    getSheetPropertiesMock.mockRejectedValue(
      new Error("Error fetching sheet properties")
    );

    render(
      <SheetsFileWidget name="spreadsheetId" schema={BASE_SHEET_SCHEMA} />,
      {
        initialValues: { spreadsheetId: "abc123" },
      }
    );

    await waitForEffect();

    expect(screen.getByRole("textbox")).toHaveDisplayValue("abc123");
  });

  it("shows workshop fallback on expression", async () => {
    render(
      <SheetsFileWidget name="spreadsheetId" schema={BASE_SHEET_SCHEMA} />,
      {
        initialValues: { spreadsheetId: makeVariableExpression("@sheet") },
      }
    );

    await waitForEffect();

    expect(screen.getByRole("textbox")).toHaveDisplayValue(
      "Use Workshop to edit"
    );
  });

  it("removes unused service on mount", async () => {
    getSheetPropertiesMock.mockResolvedValue({
      title: "Test Sheet",
    });

    const initialValues = formStateFactory(
      {
        services: [
          {
            id: validateRegistryId("google/sheet"),
            outputKey: "google" as OutputKey,
            config: uuidSequence(1),
          },
        ],
      },
      [
        brickConfigFactory({
          config: {
            spreadsheetId: "abc123",
          },
        }),
      ]
    );

    const { getFormState } = render(
      <SheetsFileWidget
        name="extension.blockPipeline[0].config.spreadsheetId"
        schema={BASE_SHEET_SCHEMA}
      />,
      { initialValues }
    );

    await waitForEffect();

    expect(getFormState().services).toHaveLength(0);
  });

  it("does not remove used service on mount", async () => {
    const service = {
      id: validateRegistryId("google/sheet"),
      outputKey: "google" as OutputKey,
      config: uuidSequence(1),
    };

    const initialValues = formStateFactory(
      {
        services: [service],
      },
      [
        brickConfigFactory({
          config: {
            spreadsheetId: makeVariableExpression("@google"),
          },
        }),
      ]
    );

    const { getFormState } = render(
      <SheetsFileWidget
        name="extension.blockPipeline[0].config.spreadsheetId"
        schema={BASE_SHEET_SCHEMA}
      />,
      { initialValues }
    );

    await waitForEffect();

    const formState = getFormState();

    expect(formState.services).toHaveLength(1);
    expect(formState.services[0]).toEqual(service);
  });

  it("displays rejected permissions message", async () => {
    useGoogleSpreadsheetPickerMock.mockReturnValue({
      showPicker: jest.fn(),
      hasRejectedPermissions: true,
      ensureSheetsTokenAction: jest.fn(),
    });

    render(
      <SheetsFileWidget name="spreadsheetId" schema={BASE_SHEET_SCHEMA} />,
      {
        initialValues: { spreadsheetId: null },
      }
    );

    await waitForEffect();

    expect(
      screen.getByText("PixieBrix cannot access your Google Account.", {
        exact: false,
      })
    ).toBeVisible();
  });
});
