/*
 * Copyright (C) 2022 PixieBrix, Inc.
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
import { render } from "@/pageEditor/testHelpers";
import ModOptionsValuesEditor from "@/pageEditor/tabs/modOptionsValues/ModOptionsValuesEditor";
import { waitForEffect } from "@/testUtils/testHelpers";
import { screen } from "@testing-library/react";
import {
  useAllModDefinitions,
  useOptionalModDefinition,
} from "@/modDefinitions/modDefinitionHooks";
import { type ModDefinition } from "@/types/modDefinitionTypes";
import databaseSchema from "@schemas/database.json";
import googleSheetIdSchema from "@schemas/googleSheetId.json";
import {
  valueToAsyncCacheState,
  valueToAsyncState,
} from "@/utils/asyncStateUtils";
import { defaultModDefinitionFactory } from "@/testUtils/factories/modDefinitionFactories";
import selectEvent from "react-select-event";
import { sanitizedIntegrationConfigFactory } from "@/testUtils/factories/integrationFactories";
import { uuidSequence } from "@/testUtils/factories/stringFactories";
import { validateRegistryId } from "@/types/helpers";
import useGoogleAccount from "@/contrib/google/sheets/core/useGoogleAccount";
import { sheets } from "@/background/messenger/api";

jest.mock("@/modDefinitions/modDefinitionHooks", () => ({
  useOptionalModDefinition: jest.fn(),
  useAllModDefinitions: jest.fn(),
}));

jest.mock("@/hooks/useFlags", () => ({
  __esModule: true,
  default: () => ({
    flagOff: () => false,
  }),
}));

jest.mock("@/contrib/google/sheets/core/useGoogleAccount", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const useGoogleAccountMock = jest.mocked(useGoogleAccount);

const getAllSpreadsheetsMock = jest.mocked(sheets.getAllSpreadsheets);

function mockModDefinition(modDefinition: ModDefinition): void {
  (useAllModDefinitions as jest.Mock).mockReturnValue(
    valueToAsyncCacheState([modDefinition]),
  );
  (useOptionalModDefinition as jest.Mock).mockReturnValue(
    valueToAsyncCacheState(modDefinition),
  );
}

const GOOGLE_PKCE_INTEGRATION_ID = validateRegistryId("google/oauth2-pkce");

beforeEach(() => {
  registerDefaultWidgets();
});

describe("ModOptionsValuesEditor", () => {
  test("renders empty options", async () => {
    const modDefinition = defaultModDefinitionFactory();
    mockModDefinition(modDefinition);
    const { asFragment } = render(<ModOptionsValuesEditor />);
    await waitForEffect();
    expect(asFragment()).toMatchSnapshot();
  });

  test("renders mod options", async () => {
    const modDefinition = defaultModDefinitionFactory({
      options: {
        schema: {
          type: "object",
          properties: {
            myStr: {
              type: "string",
            },
            myNum: {
              type: "number",
              default: 10,
            },
            myBool: {
              type: "boolean",
              default: true,
            },
            myArray: {
              type: "array",
              additionalItems: {
                type: "number",
              },
            },
            myObject: {
              type: "object",
              properties: {
                foo: {
                  type: "string",
                },
                bar: {
                  type: "number",
                },
              },
            },
            myDatabase: {
              $ref: databaseSchema.$id,
            },
            myGoogleSheet: {
              $ref: googleSheetIdSchema.$id,
            },
          },
        },
      },
    });
    mockModDefinition(modDefinition);
    const { asFragment } = render(<ModOptionsValuesEditor />);
    await waitForEffect();
    expect(asFragment()).toMatchSnapshot();
  });

  test("renders blueprint options with additional props", async () => {
    const modDefinition = defaultModDefinitionFactory({
      options: {
        schema: {
          type: "object",
          additionalProperties: {
            type: "string",
          },
        },
      },
    });
    mockModDefinition(modDefinition);
    const { asFragment } = render(<ModOptionsValuesEditor />);
    await waitForEffect();
    expect(asFragment()).toMatchSnapshot();
  });

  test("renders blueprint options with uiSchema sort order", async () => {
    const modDefinition = defaultModDefinitionFactory({
      options: {
        schema: {
          type: "object",
          properties: {
            myStr: {
              type: "string",
              title: "Input String",
            },
            myNum: {
              type: "number",
              title: "Input Number",
            },
            myBool: {
              type: "boolean",
              title: "Input Boolean",
            },
          },
        },
        uiSchema: {
          "ui:order": ["myNum", "myBool", "myStr"],
        },
      },
    });
    mockModDefinition(modDefinition);
    render(<ModOptionsValuesEditor />);

    await waitForEffect();

    const allInputs = await screen.findAllByLabelText(/^Input.+/);
    const numInput = await screen.findByLabelText("Input Number");
    const boolInput = await screen.findByLabelText("Input Boolean");
    const strInput = await screen.findByLabelText("Input String");

    expect(allInputs).toStrictEqual([numInput, boolInput, strInput]);
  });

  it("renders empty google sheet field", async () => {
    const modDefinition = defaultModDefinitionFactory({
      options: {
        schema: {
          type: "object",
          properties: {
            mySheet: {
              $ref: googleSheetIdSchema.$id,
            },
          },
          required: ["mySheet"],
        },
      },
    });
    mockModDefinition(modDefinition);

    useGoogleAccountMock.mockReturnValue(
      valueToAsyncState(
        sanitizedIntegrationConfigFactory({
          serviceId: GOOGLE_PKCE_INTEGRATION_ID,
        }),
      ),
    );

    getAllSpreadsheetsMock.mockResolvedValue({
      kind: "drive#fileList",
      incompleteSearch: false,
      files: [],
    });

    render(<ModOptionsValuesEditor />);

    const selectInput = await screen.findByRole("combobox", {
      name: "My Sheet",
    });
    expect(selectInput).toBeVisible();

    selectEvent.openMenu(selectInput);

    expect(await screen.findByText("No options")).toBeVisible();
  });

  it("renders google sheet field with options", async () => {
    const modDefinition = defaultModDefinitionFactory({
      options: {
        schema: {
          type: "object",
          properties: {
            mySheet: {
              $ref: googleSheetIdSchema.$id,
            },
          },
          required: ["mySheet"],
        },
      },
    });
    mockModDefinition(modDefinition);

    useGoogleAccountMock.mockReturnValue(
      valueToAsyncState(
        sanitizedIntegrationConfigFactory({
          serviceId: GOOGLE_PKCE_INTEGRATION_ID,
        }),
      ),
    );

    getAllSpreadsheetsMock.mockResolvedValue({
      kind: "drive#fileList",
      incompleteSearch: false,
      files: [
        {
          kind: "drive#file",
          id: uuidSequence(1),
          name: "Spreadsheet1",
          mimeType: "application/vnd.google-apps.spreadsheet",
        },
        {
          kind: "drive#file",
          id: uuidSequence(2),
          name: "AnotherSpreadsheet",
          mimeType: "application/vnd.google-apps.spreadsheet",
        },
        {
          kind: "drive#file",
          id: uuidSequence(3),
          name: "One More Spreadsheet",
          mimeType: "application/vnd.google-apps.spreadsheet",
        },
      ],
    });

    render(<ModOptionsValuesEditor />);

    const selectInput = await screen.findByRole("combobox", {
      name: "My Sheet",
    });
    expect(selectInput).toBeVisible();

    selectEvent.openMenu(selectInput);

    expect(await screen.findByText("Spreadsheet1")).toBeVisible();
    expect(await screen.findByText("AnotherSpreadsheet")).toBeVisible();
    expect(await screen.findByText("One More Spreadsheet")).toBeVisible();
  });
});
