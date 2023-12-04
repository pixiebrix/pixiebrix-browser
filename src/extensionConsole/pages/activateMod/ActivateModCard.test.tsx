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
import ActivateModCard from "@/extensionConsole/pages/activateMod/ActivateModPage";
import { waitForEffect } from "@/testUtils/testHelpers";
import { screen } from "@testing-library/react";
import registerDefaultWidgets from "@/components/fields/schemaFields/widgets/registerDefaultWidgets";
import { type RegistryId } from "@/types/registryTypes";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { type ModDefinition } from "@/types/modDefinitionTypes";
import { appApiMock } from "@/testUtils/appApiMock";
import { useGetRecipeQuery } from "@/services/api";
import AsyncStateGate from "@/components/AsyncStateGate";
import { validateRegistryId } from "@/types/helpers";
import { type RecipeResponse } from "@/types/contract";
import {
  modComponentDefinitionFactory,
  defaultModDefinitionFactory,
} from "@/testUtils/factories/modDefinitionFactories";
import { metadataFactory } from "@/testUtils/factories/metadataFactory";
import useActivateRecipe, {
  type ActivateRecipeFormCallback,
} from "@/activation/useActivateRecipe";
import { minimalSchemaFactory } from "@/utils/schemaUtils";

registerDefaultWidgets();

const testModId = validateRegistryId("@test/mod");

const activateModCallbackMock =
  jest.fn() as jest.MockedFunction<ActivateRecipeFormCallback>;

jest.mock("@/activation/useActivateRecipe.ts", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const activateRecipeHookMock = jest.mocked(
  useActivateRecipe,
) as jest.MockedFunction<typeof useActivateRecipe>;

jest.mock("@/extensionConsole/pages/useRegistryIdParam", () => ({
  __esModule: true,
  default: jest.fn(() => testModId),
}));

global.chrome.commands.getAll = jest.fn();

function setupMod(modDefinition: ModDefinition) {
  const recipeResponse: RecipeResponse = {
    config: modDefinition,
    updated_at: modDefinition.updated_at,
    sharing: {
      public: false,
      organizations: [],
    },
  };

  appApiMock
    .onGet(`/api/recipes/${encodeURIComponent(testModId)}/`)
    .reply(200, recipeResponse)
    // Databases, organizations, etc.
    .onGet()
    .reply(200, []);
}

beforeEach(() => {
  appApiMock.reset();
  jest.clearAllMocks();
  activateRecipeHookMock.mockReturnValue(activateModCallbackMock);
});

// Activate Mod Card is always rendered when the mod has already been found
const ModCard: React.FC = () => {
  const recipeState = useGetRecipeQuery({
    recipeId: testModId,
  });
  return (
    <MemoryRouter>
      <AsyncStateGate state={recipeState}>
        {() => <ActivateModCard />}
      </AsyncStateGate>
    </MemoryRouter>
  );
};

describe("ActivateRecipeCard", () => {
  test("renders", async () => {
    setupMod(defaultModDefinitionFactory());
    const { asFragment } = render(<ModCard />);
    await waitForEffect();
    expect(asFragment()).toMatchSnapshot();
  });

  test("renders successfully with null services property", async () => {
    setupMod(
      defaultModDefinitionFactory({
        extensionPoints: [modComponentDefinitionFactory({ services: null })],
      }),
    );
    const { asFragment } = render(<ModCard />);
    await waitForEffect();
    expect(asFragment()).toMatchSnapshot();
  });

  test("activate mod definition with missing required mod definition options", async () => {
    const modDefinition = defaultModDefinitionFactory({
      metadata: metadataFactory({
        id: "test/blueprint-with-required-options" as RegistryId,
        name: "Mod with Required Options",
      }),
      options: {
        schema: {
          $schema: "https://json-schema.org/draft/2019-09/schema#",
          properties: {
            database: {
              $ref: "https://app.pixiebrix.com/schemas/database#",
              title: "Database",
            },
          },
          required: ["database"],
          type: "object",
        },
        uiSchema: {},
      },
      extensionPoints: [
        modComponentDefinitionFactory({
          label: "Starter Brick for Mod with Required Options",
        }),
      ],
    });
    setupMod(modDefinition);

    const { asFragment } = render(<ModCard />);
    await waitForEffect();
    expect(asFragment()).toMatchSnapshot();
    await userEvent.click(screen.getByText("Activate"));
    expect(screen.getByText("Database is a required field")).not.toBeNull();
  });

  test("activate mod definition permissions", async () => {
    const modDefinition = defaultModDefinitionFactory({
      metadata: metadataFactory({
        id: "test/blueprint-with-required-options" as RegistryId,
        name: "A Mod",
      }),
      extensionPoints: [
        modComponentDefinitionFactory({
          label: "A Starter Brick for Mod",
        }),
      ],
    });
    setupMod(modDefinition);

    const { asFragment } = render(<ModCard />);
    await waitForEffect();
    expect(asFragment()).toMatchSnapshot();
    await userEvent.click(screen.getByText("Activate"));
    await waitForEffect();
    expect(activateModCallbackMock).toHaveBeenCalledWith(
      {
        extensions: { "0": true },
        optionsArgs: {},
        integrationDependencies: [],
      },
      modDefinition,
    );
  });

  test("user reject permissions", async () => {
    activateModCallbackMock.mockResolvedValue({
      success: false,
      error: "You must accept browser permissions to activate",
    });

    const modDefinition = defaultModDefinitionFactory({
      metadata: metadataFactory({
        id: validateRegistryId("test/blueprint-with-required-options"),
        name: "A Mod",
      }),
      extensionPoints: [
        modComponentDefinitionFactory({
          label: "A Starter Brick for Mod",
        }),
      ],
    });
    setupMod(modDefinition);

    render(<ModCard />);
    await waitForEffect();
    await userEvent.click(screen.getByText("Activate"));
    await waitForEffect();

    expect(
      screen.getByText("You must accept browser permissions to activate"),
    ).toBeVisible();
  });

  test("renders instructions", async () => {
    const mod = defaultModDefinitionFactory();
    mod.options = {
      schema: {
        ...minimalSchemaFactory(),
        description: "These are some instructions",
      },
    };
    setupMod(mod);
    const { asFragment } = render(<ModCard />);

    await waitForEffect();

    expect(screen.getByText("These are some instructions")).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });
});
