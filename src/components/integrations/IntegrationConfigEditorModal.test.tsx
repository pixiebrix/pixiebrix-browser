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

import React from "react";
import { fromJS } from "@/integrations/UserDefinedIntegration";
import IntegrationConfigEditorModal from "@/components/integrations/IntegrationConfigEditorModal";
import { render, screen } from "@/extensionConsole/testHelpers";
import { waitForEffect } from "@/testUtils/testHelpers";

// FIXME: Use ?loadAsText when supported by Jest https://github.com/jestjs/jest/pull/6282
import pipedriveYaml from "@contrib/integrations/pipedrive.yaml";
import registerDefaultWidgets from "@/components/fields/schemaFields/widgets/registerDefaultWidgets";
import { type IntegrationConfig } from "@/integrations/integrationTypes";
import { within } from "@testing-library/react";
import { fieldLabel } from "@/components/fields/fieldUtils";
import { convertSchemaToConfigState } from "@/components/integrations/integrationHelpers";

beforeAll(() => {
  registerDefaultWidgets();
});

describe("IntegrationConfigEditorModal", () => {
  test("Can render Pipedrive configuration modal without existing configuration", async () => {
    const integration = fromJS(pipedriveYaml as any);

    render(
      <IntegrationConfigEditorModal
        initialValues={
          {
            label: "",
            integrationId: integration.id,
            config: convertSchemaToConfigState(integration.schema),
          } as IntegrationConfig
        }
        onDelete={jest.fn()}
        onSave={jest.fn()}
        onClose={jest.fn()}
        integration={integration}
      />,
    );

    await waitForEffect();

    expect(screen.getByDisplayValue("pipedrive/api")).not.toBeNull();
    expect(screen.getByText("Save")).not.toBeNull();
    expect(screen.getByText("Delete")).not.toBeNull();
    expect(screen.getByText("Close")).not.toBeNull();

    const dialogRoot = screen.getByRole("dialog");
    for (const property of Object.keys(integration.schema.properties)) {
      expect(
        within(dialogRoot).getByLabelText(fieldLabel(property)),
      ).toBeVisible();
    }
  });
});
