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

import { Schema } from "@/core";

export type ListResponse<TData> = {
  page: {
    offset: number;
    total: number;
    totalFilter: number;
  };
  list: TData[];
};

export const BOT_TYPE = "application/vnd.aa.taskbot";

export type Variable = {
  name: string;
  input: boolean;
  type: "STRING";
  description: string;
};

export type Interface = {
  variables: Variable[];
};

// https://docs.automationanywhere.com/bundle/enterprise-v11.3/page/enterprise/topics/control-room/control-room-api/orchestrator-bot-details.html
export type Bot = {
  id: string;
  parentId: string;
  name: string;
  path: string;
  type: typeof BOT_TYPE;
};

export type Device = {
  id: string;
  type: string;
  hostName: string;
  status: "CONNECTED";
  botAgentVersion: string;
  nickname: string;
};

export type DeployResponse = {
  // https://docs.automationanywhere.com/bundle/enterprise-v11.3/page/enterprise/topics/control-room/control-room-api/orchestrator-bot-deploy.html
  automationId: string;
  deploymentId: string;
};

export type Activity = {
  status: string;
  outputVariables?: Record<
    string,
    {
      string: string;
    }
  >;
};

export function interfaceToInputSchema(botInterface: Interface): Schema {
  return {
    type: "object",
    properties: Object.fromEntries(
      botInterface.variables
        .filter((variable) => variable.input)
        .map((variable) => [
          variable.name,
          {
            type: "string",
            description: variable.description,
          },
        ])
    ),
  };
}
