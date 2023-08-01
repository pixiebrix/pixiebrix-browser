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

import { validateRegistryId } from "@/types/helpers";
import { isCommunityControlRoom } from "@/contrib/automationanywhere/aaUtils";
import {
  DEFAULT_MAX_WAIT_MILLIS,
  pollEnterpriseResult,
  runCommunityBot,
  runEnterpriseBot,
} from "@/contrib/automationanywhere/aaApi";
import {
  type BotArgs,
  type EnterpriseBotArgs,
} from "@/contrib/automationanywhere/aaTypes";
import { BusinessError, PropError } from "@/errors/businessErrors";
import {
  CONTROL_ROOM_OAUTH_INTEGRATION_ID,
  CONTROL_ROOM_TOKEN_INTEGRATION_ID,
} from "@/services/constants";
import { cloneDeep } from "lodash";
import { getCachedAuthData, getUserData } from "@/background/messenger/api";
import { type Schema, type SchemaProperties } from "@/types/schemaTypes";
import { TransformerABC } from "@/types/bricks/transformerTypes";
import { type BrickArgs, type BrickOptions } from "@/types/runtimeTypes";
import { type UnknownObject } from "@/types/objectTypes";

export const AUTOMATION_ANYWHERE_RUN_BOT_ID = validateRegistryId(
  "@pixiebrix/automation-anywhere/run-bot"
);

export const COMMON_PROPERTIES: SchemaProperties = {
  service: {
    anyOf: [
      CONTROL_ROOM_TOKEN_INTEGRATION_ID,
      CONTROL_ROOM_OAUTH_INTEGRATION_ID,
    ].map((id) => ({
      $ref: `https://app.pixiebrix.com/schemas/services/${id}`,
    })),
  },
  workspaceType: {
    type: "string",
    enum: ["private", "public"],
    description: "The workspace that contains the bot",
    default: "private",
  },
  fileId: {
    type: "string",
    description: "The file id of the bot",
    format: "\\d+",
  },
  data: {
    type: "object",
    description: "The input data for the bot",
    additionalProperties: true,
  },
};

const COMMUNITY_EDITION_PROPERTIES: SchemaProperties = {
  deviceId: {
    type: "string",
    description: "The device to run the bot",
    format: "\\d+",
  },
};

export const ENTERPRISE_EDITION_COMMON_PROPERTIES: SchemaProperties = {
  isAttended: {
    type: "boolean",
    description:
      "Run the bot in attended mode, using the authenticated user's device. Requires an Attended Bot license",
    default: false,
  },
  awaitResult: {
    type: "boolean",
    default: false,
    description: "Wait for the bot to complete and return the output",
  },
  maxWaitMillis: {
    type: "number",
    default: DEFAULT_MAX_WAIT_MILLIS,
    description:
      "Maximum time (in milliseconds) to wait for the bot to complete when awaiting result.",
  },
};

const ENTERPRISE_EDITION_PUBLIC_PROPERTIES: SchemaProperties = {
  runAsUserIds: {
    type: "array",
    description: "The user(s) to run the bot",
    items: {
      type: "string",
    },
  },
  poolIds: {
    type: "array",
    description: "A device pool that has at least one active device (optional)",
    items: {
      type: "string",
    },
  },
};

export class RunBot extends TransformerABC {
  constructor() {
    super(
      AUTOMATION_ANYWHERE_RUN_BOT_ID,
      "Run Automation Anywhere Bot",
      "Run an Automation Anywhere Bot via the Control Room API"
    );
  }

  inputSchema: Schema = {
    $schema: "https://json-schema.org/draft/2019-09/schema#",
    anyOf: [
      {
        type: "object",
        properties: {
          ...COMMON_PROPERTIES,
          ...COMMUNITY_EDITION_PROPERTIES,
        },
      },
      {
        type: "object",
        properties: {
          ...COMMON_PROPERTIES,
          ...ENTERPRISE_EDITION_COMMON_PROPERTIES,
          ...ENTERPRISE_EDITION_PUBLIC_PROPERTIES,
        },
      },
      {
        type: "object",
        properties: {
          ...COMMON_PROPERTIES,
          ...ENTERPRISE_EDITION_COMMON_PROPERTIES,
        },
      },
    ],
  };

  defaultOutputKey = "bot";

  override outputSchema: Schema = {
    $schema: "https://json-schema.org/draft/2019-09/schema#",
    type: "object",
    additionalProperties: true,
  };

  async transform(
    args: BrickArgs<BotArgs>,
    { logger }: BrickOptions
  ): Promise<UnknownObject> {
    const {
      awaitResult,
      maxWaitMillis = DEFAULT_MAX_WAIT_MILLIS,
      service,
    } = args;

    if (isCommunityControlRoom(service.config.controlRoomUrl)) {
      if (!("deviceId" in args)) {
        throw new PropError(
          "deviceId is required for Community Edition",
          this.id,
          "deviceId",
          undefined
        );
      }

      if (awaitResult) {
        throw new PropError(
          "Cannot await result with Community Edition",
          this.id,
          "awaitResult",
          awaitResult
        );
      }

      await runCommunityBot(args);
      return {};
    }

    const enterpriseBotArgs: EnterpriseBotArgs = cloneDeep(
      args as unknown as EnterpriseBotArgs
    );

    let runAsUserIds: number[] = enterpriseBotArgs.runAsUserIds ?? [];
    if (
      enterpriseBotArgs.isAttended &&
      service.serviceId === CONTROL_ROOM_OAUTH_INTEGRATION_ID
    ) {
      // Attended mode uses the authenticated user id as a runAsUserId

      const { partnerPrincipals = [] } = await getUserData();

      const principal = partnerPrincipals.find(
        (x) => x.control_room_url === service.config.controlRoomUrl
      );
      if (!principal) {
        throw new PropError(
          "No OAuth2 principal data found for Control Room",
          this.id,
          "isAttended",
          enterpriseBotArgs.isAttended
        );
      }

      runAsUserIds = [principal.control_room_user_id];
      enterpriseBotArgs.poolIds = [];
    } else if (
      enterpriseBotArgs.isAttended &&
      service.serviceId === CONTROL_ROOM_TOKEN_INTEGRATION_ID
    ) {
      // Attended mode uses the authenticated user id as a runAsUserId

      // Get the user id from the cached token data. AA doesn't have any endpoints for retrieving the user id that
      // we could automatically fetch in the Page Editor
      const userData = (await getCachedAuthData(service.id)) as unknown as {
        user: { id: number };
      };
      if (!userData) {
        throw new BusinessError(
          "User profile for Control Room not found. Reconnect the Control Room integration"
        );
      }

      const userId = userData?.user?.id;
      if (userId == null) {
        // Indicates the Control Room provided an unexpected response shape
        throw new Error("Control Room token response missing user id.");
      }

      runAsUserIds = [userId];
      enterpriseBotArgs.poolIds = [];
    }

    const deployment = await runEnterpriseBot({
      ...enterpriseBotArgs,
      runAsUserIds,
    });

    if (!awaitResult) {
      return deployment;
    }

    return pollEnterpriseResult({
      service,
      deploymentId: deployment.deploymentId,
      logger,
      maxWaitMillis,
    });
  }
}
