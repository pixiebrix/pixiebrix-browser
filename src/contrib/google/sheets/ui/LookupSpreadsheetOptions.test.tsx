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
import registerDefaultWidgets from "@/components/fields/schemaFields/widgets/registerDefaultWidgets";
import { waitForEffect } from "@/testUtils/testHelpers";
import LookupSpreadsheetOptions from "@/contrib/google/sheets/ui/LookupSpreadsheetOptions";
import { act, screen } from "@testing-library/react";
import {
  makeTemplateExpression,
  makeVariableExpression,
} from "@/runtime/expressionCreators";
import { validateRegistryId } from "@/types/helpers";
import selectEvent from "react-select-event";
import { render } from "@/pageEditor/testHelpers";
import { services, sheets } from "@/background/messenger/api";
import { uuidSequence } from "@/testUtils/factories/stringFactories";
import { sanitizedIntegrationConfigFactory } from "@/testUtils/factories/integrationFactories";
import {
  type FileList,
  type Spreadsheet,
} from "@/contrib/google/sheets/core/types";
import { type UUID } from "@/types/stringTypes";
import { useAuthOptions } from "@/hooks/auth";
import { type AuthOption } from "@/auth/authTypes";
import { type IntegrationDependency } from "@/types/integrationTypes";
import { validateOutputKey } from "@/runtime/runtimeTypes";
import { valueToAsyncState } from "@/utils/asyncStateUtils";
import {
  isGAPISupported,
  isGoogleInitialized,
} from "@/contrib/google/initGoogle";

let idSequence = 0;
function newId(): UUID {
  return uuidSequence(idSequence++);
}

const servicesLocateMock = jest.mocked(services.locate);

jest.mock("@/contrib/google/initGoogle", () => ({
  isGoogleInitialized: jest.fn(),
  isGAPISupported: jest.fn(),
  subscribe: jest.fn().mockImplementation(() => () => {}),
}));

const isGAPISupportedMock = jest.mocked(isGAPISupported);
const isGoogleInitializedMock = jest.mocked(isGoogleInitialized);

jest.mock("@/hooks/auth", () => ({
  useAuthOptions: jest.fn(),
}));

const useAuthOptionsMock = jest.mocked(useAuthOptions);

const getAllSpreadsheetsMock = jest.mocked(sheets.getAllSpreadsheets);
const getSpreadsheetMock = jest.mocked(sheets.getSpreadsheet);
const getSheetPropertiesMock = jest.mocked(sheets.getSheetProperties);
const getTabNamesMock = jest.mocked(sheets.getTabNames);
const getHeadersMock = jest.mocked(sheets.getHeaders);

const TEST_SPREADSHEET_ID = newId();
const GOOGLE_SHEET_SERVICE_ID = validateRegistryId("google/sheet");
const GOOGLE_PKCE_SERVICE_ID = validateRegistryId("google/oauth2-pkce");
const GOOGLE_PKCE_AUTH_CONFIG = newId();
const TEST_SPREADSHEET_AUTH_CONFIG = newId();

const TEST_SPREADSHEET_NAME = "Test Spreadsheet";

const servicesLookup = {
  [GOOGLE_SHEET_SERVICE_ID]: sanitizedIntegrationConfigFactory({
    serviceId: GOOGLE_SHEET_SERVICE_ID,
    config: {
      _sanitizedConfigBrand: null,
      spreadsheetId: TEST_SPREADSHEET_ID,
    },
  }),
  [GOOGLE_PKCE_SERVICE_ID]: sanitizedIntegrationConfigFactory({
    serviceId: GOOGLE_PKCE_SERVICE_ID,
  }),
};

const googlePKCEAuthOption: AuthOption = {
  serviceId: GOOGLE_PKCE_SERVICE_ID,
  label: "Google OAuth2 PKCE",
  local: true,
  value: GOOGLE_PKCE_AUTH_CONFIG,
  sharingType: "private",
};

const testSpreadsheetAuthOption: AuthOption = {
  serviceId: GOOGLE_SHEET_SERVICE_ID,
  label: "Test Spreadsheet",
  local: true,
  value: TEST_SPREADSHEET_AUTH_CONFIG,
  sharingType: "private",
};

const googlePKCEIntegrationDependency: IntegrationDependency = {
  id: GOOGLE_PKCE_SERVICE_ID,
  outputKey: validateOutputKey("google"),
  config: GOOGLE_PKCE_AUTH_CONFIG,
};

const testSpreadsheet: Spreadsheet = {
  spreadsheetId: TEST_SPREADSHEET_ID,
  properties: {
    title: TEST_SPREADSHEET_NAME,
  },
  sheets: [
    {
      properties: {
        sheetId: 123,
        title: "Tab1",
      },
    },
    {
      properties: {
        sheetId: 456,
        title: "Tab2",
      },
    },
  ],
};

const fileListResponse: FileList = {
  kind: "drive#fileList",
  incompleteSearch: false,
  files: [
    {
      kind: "drive#file",
      mimeType: "application/vnd.google-apps.spreadsheet",
      id: TEST_SPREADSHEET_ID,
      name: TEST_SPREADSHEET_NAME,
    },
  ],
};

async function expectTabsAndHeadersToBeLoaded() {
  const tabChooser = await screen.findByLabelText("Tab Name");
  let headerChooser = await screen.findByLabelText("Column Header");
  // Shows the header names for Tab1 in the dropdown
  selectEvent.openMenu(headerChooser);
  // Input value and select option in the dropdown, 2 instances
  const column1Options = screen.getAllByText("Column1");
  expect(column1Options).toHaveLength(2);
  expect(column1Options[0]).toBeVisible();
  expect(column1Options[1]).toBeVisible();
  expect(screen.getByText("Column2")).toBeVisible();
  // Does not show headers for Tab2
  expect(screen.queryByText("Foo")).not.toBeInTheDocument();
  expect(screen.queryByText("Bar")).not.toBeInTheDocument();

  // Choose Tab2
  await act(async () => {
    await selectEvent.select(tabChooser, "Tab2");
  });

  // Need to grab the chooser again because props changed and the header select component was re-rendered
  headerChooser = await screen.findByLabelText("Column Header");

  // Shows the header names for Tab2 in the dropdown
  selectEvent.openMenu(headerChooser);
  // Input value and select option in the dropdown, 2 instances
  const fooOptions = screen.getAllByText("Foo");
  expect(fooOptions).toHaveLength(2);
  expect(fooOptions[0]).toBeVisible();
  expect(fooOptions[1]).toBeVisible();
  expect(screen.getByText("Bar")).toBeVisible();
  // Does not show the headers for Tab1
  expect(screen.queryByText("Column1")).not.toBeInTheDocument();
  expect(screen.queryByText("Column2")).not.toBeInTheDocument();
}

beforeAll(() => {
  registerDefaultWidgets();
  servicesLocateMock.mockImplementation(
    async (serviceId) => servicesLookup[serviceId]
  );
  useAuthOptionsMock.mockReturnValue(
    valueToAsyncState([googlePKCEAuthOption, testSpreadsheetAuthOption])
  );
  getAllSpreadsheetsMock.mockResolvedValue(fileListResponse);
  getSpreadsheetMock.mockResolvedValue(testSpreadsheet);
  getSheetPropertiesMock.mockResolvedValue({ title: TEST_SPREADSHEET_NAME });
  getTabNamesMock.mockResolvedValue(["Tab1", "Tab2"]);
  getHeadersMock.mockImplementation(async ({ tabName }) => {
    if (tabName === "Tab1") {
      return ["Column1", "Column2"];
    }

    return ["Foo", "Bar"];
  });
});

beforeEach(() => {
  isGoogleInitializedMock.mockReturnValue(true);
  isGAPISupportedMock.mockReturnValue(true);
});

describe("LookupSpreadsheetOptions", () => {
  /**
   * Snapshots
   */

  test("given empty googleAccount and string spreadsheetId and empty tabName, when rendered, should match snapshot", async () => {
    const rendered = render(
      <LookupSpreadsheetOptions name="" configKey="config" />,
      {
        initialValues: {
          config: {
            spreadsheetId: TEST_SPREADSHEET_ID,
            tabName: makeTemplateExpression("nunjucks", ""),
            header: makeTemplateExpression("nunjucks", ""),
            query: makeTemplateExpression("nunjucks", ""),
            multi: false,
          },
        },
      }
    );

    await waitForEffect();

    expect(rendered.asFragment()).toMatchSnapshot();
  });

  test("given empty googleAccount and string spreadsheetId and selected tabName/header and entered query, when rendered, should match snapshot", async () => {
    const rendered = render(
      <LookupSpreadsheetOptions name="" configKey="config" />,
      {
        initialValues: {
          config: {
            spreadsheetId: TEST_SPREADSHEET_ID,
            tabName: "Tab2",
            header: "Bar",
            query: makeTemplateExpression("nunjucks", "test query"),
            multi: false,
          },
        },
      }
    );

    await waitForEffect();

    expect(rendered.asFragment()).toMatchSnapshot();
  });

  test("given test googleAccount and string spreadsheetId and empty tabName, when rendered, should match snapshot", async () => {
    const rendered = render(
      <LookupSpreadsheetOptions name="" configKey="config" />,
      {
        initialValues: {
          config: {
            googleAccount: makeVariableExpression("@google"),
            spreadsheetId: TEST_SPREADSHEET_ID,
            tabName: makeTemplateExpression("nunjucks", ""),
            header: makeTemplateExpression("nunjucks", ""),
            query: makeTemplateExpression("nunjucks", ""),
            multi: false,
          },
          services: [googlePKCEIntegrationDependency],
        },
      }
    );

    await waitForEffect();

    expect(rendered.asFragment()).toMatchSnapshot();
  });

  test("given test googleAccount and string spreadsheetId and selected tabName/header and entered query, when rendered, should match snapshot", async () => {
    const rendered = render(
      <LookupSpreadsheetOptions name="" configKey="config" />,
      {
        initialValues: {
          config: {
            googleAccount: makeVariableExpression("@google"),
            spreadsheetId: TEST_SPREADSHEET_ID,
            tabName: "Tab2",
            header: "Bar",
            query: makeTemplateExpression("nunjucks", "test query"),
            multi: false,
          },
          services: [googlePKCEIntegrationDependency],
        },
      }
    );

    await waitForEffect();

    expect(rendered.asFragment()).toMatchSnapshot();
  });

  /**
   * Basic Render Tests
   */

  test("given empty googleAccount and string spreadsheetId, when rendered, loads tab names and header values", async () => {
    render(<LookupSpreadsheetOptions name="" configKey="config" />, {
      initialValues: {
        config: {
          spreadsheetId: TEST_SPREADSHEET_ID,
          tabName: makeTemplateExpression("nunjucks", ""),
          header: makeTemplateExpression("nunjucks", ""),
          query: makeTemplateExpression("nunjucks", ""),
          multi: false,
        },
      },
    });

    await waitForEffect();

    // Tab1 will be picked automatically since it's first in the list
    expect(screen.getByText("Tab1")).toBeVisible();

    await expectTabsAndHeadersToBeLoaded();
  });

  test("given empty googleAccount and mod input spreadsheetId, when rendered, loads tab names and header values", async () => {
    render(<LookupSpreadsheetOptions name="" configKey="config" />, {
      initialValues: {
        config: {
          spreadsheetId: makeVariableExpression("@options.sheetId"),
          tabName: makeTemplateExpression("nunjucks", ""),
          header: makeTemplateExpression("nunjucks", ""),
          query: makeTemplateExpression("nunjucks", ""),
          multi: false,
        },
        optionsArgs: {
          sheetId: TEST_SPREADSHEET_ID,
        },
      },
    });

    await waitForEffect();

    // Tab1 will be picked automatically since it's first in the list
    expect(screen.getByText("Tab1")).toBeVisible();

    await expectTabsAndHeadersToBeLoaded();
  });

  test("given test googleAccount and string spreadsheetId, when rendered, loads tab names and header values", async () => {
    render(<LookupSpreadsheetOptions name="" configKey="config" />, {
      initialValues: {
        config: {
          googleAccount: makeVariableExpression("@google"),
          spreadsheetId: TEST_SPREADSHEET_ID,
          tabName: makeTemplateExpression("nunjucks", ""),
          header: makeTemplateExpression("nunjucks", ""),
          query: makeTemplateExpression("nunjucks", ""),
          multi: false,
        },
        services: [googlePKCEIntegrationDependency],
      },
    });

    await waitForEffect();

    // Tab1 will be picked automatically since it's first in the list
    expect(screen.getByText("Tab1")).toBeVisible();

    await expectTabsAndHeadersToBeLoaded();
  });

  test("given test googleAccount and mod input spreadsheetId, when rendered, loads tab names and header values", async () => {
    render(<LookupSpreadsheetOptions name="" configKey="config" />, {
      initialValues: {
        config: {
          googleAccount: makeVariableExpression("@google"),
          spreadsheetId: makeVariableExpression("@options.sheetId"),
          tabName: makeTemplateExpression("nunjucks", ""),
          header: makeTemplateExpression("nunjucks", ""),
          query: makeTemplateExpression("nunjucks", ""),
          multi: false,
        },
        optionsArgs: {
          sheetId: TEST_SPREADSHEET_ID,
        },
        services: [googlePKCEIntegrationDependency],
      },
    });

    await waitForEffect();

    // Tab1 will be picked automatically since it's first in the list
    expect(screen.getByText("Tab1")).toBeVisible();

    await expectTabsAndHeadersToBeLoaded();
  });

  test("given test googleAccount and null spreadsheetId, when spreadsheet selected, loads tab names and header values", async () => {
    render(<LookupSpreadsheetOptions name="" configKey="config" />, {
      initialValues: {
        config: {
          googleAccount: makeVariableExpression("@google"),
          spreadsheetId: null,
          tabName: makeTemplateExpression("nunjucks", ""),
          header: makeTemplateExpression("nunjucks", ""),
          query: makeTemplateExpression("nunjucks", ""),
          multi: false,
        },
        services: [googlePKCEIntegrationDependency],
      },
    });

    await waitForEffect();

    // Select the first spreadsheet
    const spreadsheetSelect = screen.getByRole("combobox", {
      name: "Google Sheet",
    });
    await act(async () => {
      await selectEvent.select(spreadsheetSelect, TEST_SPREADSHEET_NAME);
    });

    // Tab1 will be picked automatically since it's first in the list
    expect(screen.getByText("Tab1")).toBeVisible();

    await expectTabsAndHeadersToBeLoaded();
  });

  /**
   * Does Not Clear Initial Values
   */

  test("given empty googleAccount and mod input spreadsheetId value, when rendered, does not clear initial tabName and header values", async () => {
    render(<LookupSpreadsheetOptions name="" configKey="config" />, {
      initialValues: {
        config: {
          spreadsheetId: makeVariableExpression("@options.sheetId"),
          tabName: "Tab2",
          header: "Bar",
          query: makeTemplateExpression("nunjucks", "test query"),
          multi: true,
        },
        optionsArgs: {
          sheetId: TEST_SPREADSHEET_ID,
        },
      },
    });

    await waitForEffect();

    expect(screen.getByDisplayValue("@options.sheetId")).toBeVisible();
    // Use getByText for react-select value
    expect(screen.getByText("Tab2")).toBeVisible();
    // Use getByText for react-select value
    expect(screen.getByText("Bar")).toBeVisible();
    expect(screen.getByDisplayValue("test query")).toBeVisible();
  });

  test("given empty googleAccount and string spreadsheetId value, when rendered, does not clear initial tabName and header values", async () => {
    render(<LookupSpreadsheetOptions name="" configKey="config" />, {
      initialValues: {
        config: {
          spreadsheetId: TEST_SPREADSHEET_ID,
          tabName: "Tab2",
          header: "Bar",
          query: makeTemplateExpression("nunjucks", "test query"),
          multi: true,
        },
      },
    });

    await waitForEffect();

    // Spreadsheet ID should not be user-visible
    expect(screen.queryByText(TEST_SPREADSHEET_ID)).not.toBeInTheDocument();
    // Legacy sheet picker is an input; need to use getByDisplayValue
    expect(screen.getByDisplayValue(TEST_SPREADSHEET_NAME)).toBeVisible();
    // Use getByText for react-select value
    expect(screen.getByText("Tab2")).toBeVisible();
    // Use getByText for react-select value
    expect(screen.getByText("Bar")).toBeVisible();
    expect(screen.getByDisplayValue("test query")).toBeVisible();
  });

  test("given test googleAccount and mod input spreadsheetId value, when rendered, does not clear variable values", async () => {
    render(<LookupSpreadsheetOptions name="" configKey="config" />, {
      initialValues: {
        config: {
          googleAccount: makeVariableExpression("@google"),
          spreadsheetId: makeVariableExpression("@options.sheetId"),
          tabName: makeVariableExpression("@myTab"),
          header: makeVariableExpression("@myHeader"),
          query: makeVariableExpression("@query"),
          multi: false,
        },
        optionsArgs: {
          sheetId: TEST_SPREADSHEET_ID,
        },
        services: [googlePKCEIntegrationDependency],
      },
    });

    await waitForEffect();

    expect(screen.getByDisplayValue("@options.sheetId")).toBeVisible();
    expect(screen.getByDisplayValue("@myTab")).toBeVisible();
    expect(screen.getByDisplayValue("@myHeader")).toBeVisible();
    expect(screen.getByDisplayValue("@query")).toBeVisible();
  });

  test("given test googleAccount and string spreadsheetId value, when rendered, does not clear variable values", async () => {
    render(<LookupSpreadsheetOptions name="" configKey="config" />, {
      initialValues: {
        config: {
          googleAccount: makeVariableExpression("@google"),
          spreadsheetId: TEST_SPREADSHEET_ID,
          tabName: makeVariableExpression("@myTab"),
          header: makeVariableExpression("@myHeader"),
          query: makeVariableExpression("@query"),
          multi: false,
        },
        services: [googlePKCEIntegrationDependency],
      },
    });

    await waitForEffect();

    // Spreadsheet ID should not be user-visible
    expect(screen.queryByText(TEST_SPREADSHEET_ID)).not.toBeInTheDocument();
    // Loaded spreadsheets use select widget, which renders the selected value into the DOM as text, so can use getByText
    expect(screen.getByText(TEST_SPREADSHEET_NAME)).toBeVisible();
    expect(screen.getByDisplayValue("@myTab")).toBeVisible();
    expect(screen.getByDisplayValue("@myHeader")).toBeVisible();
    expect(screen.getByDisplayValue("@query")).toBeVisible();
  });

  /**
   * Require Google HOC Tests
   */

  it("should require GAPI support", async () => {
    isGoogleInitializedMock.mockReturnValue(false);
    isGAPISupportedMock.mockReturnValue(false);

    const rendered = render(
      <LookupSpreadsheetOptions name="" configKey="config" />,
      {
        initialValues: { config: {} },
      }
    );

    await waitForEffect();

    expect(rendered.asFragment()).toMatchSnapshot();
  });

  it("should require GAPI loaded", async () => {
    isGoogleInitializedMock.mockReturnValue(false);
    isGAPISupportedMock.mockReturnValue(true);

    const rendered = render(
      <LookupSpreadsheetOptions name="" configKey="config" />,
      {
        initialValues: { config: {} },
      }
    );

    await waitForEffect();

    expect(rendered.asFragment()).toMatchSnapshot();
  });
});
