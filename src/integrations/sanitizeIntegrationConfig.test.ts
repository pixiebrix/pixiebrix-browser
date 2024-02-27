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

import { sanitizeIntegrationConfig } from "@/integrations/sanitizeIntegrationConfig";
import automationAnywhere from "@contrib/integrations/automation-anywhere.yaml";
import { fromJS } from "@/integrations/UserDefinedIntegration";
import type { IntegrationDefinition } from "@/integrations/integrationTypes";

const aaIntegration = fromJS(
  automationAnywhere as unknown as IntegrationDefinition,
);

describe("sanitizeIntegrationConfig", () => {
  it("sanitizes config with secret", () => {
    const config = {
      controlRoomUrl: "https://controlroom.example.com",
      username: "user",
      password: "pass",
    };
    const sanitizedConfig = sanitizeIntegrationConfig(aaIntegration, config);
    expect(sanitizedConfig).toEqual({
      controlRoomUrl: config.controlRoomUrl,
      username: config.username,
    });
  });

  it("sanitizes config with optional field", () => {
    const config = {
      controlRoomUrl: "https://controlroom.example.com",
      username: "user",
      apiKey: "pass",
      folderId: "12345",
    };
    const sanitizedConfig = sanitizeIntegrationConfig(aaIntegration, config);
    expect(sanitizedConfig).toEqual({
      controlRoomUrl: config.controlRoomUrl,
      username: config.username,
      folderId: config.folderId,
    });
  });
});
