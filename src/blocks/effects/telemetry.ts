/*
 * Copyright (C) 2021 PixieBrix, Inc.
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

import { Effect } from "@/types";
import { BlockArg, Schema } from "@/core";
import { registerBlock } from "@/blocks/registry";
import { PropError } from "@/errors";
import { reportEvent } from "@/telemetry/events";

export class TelemetryEffect extends Effect {
  constructor() {
    super(
      "@pixiebrix/telemetry",
      "Send Telemetry",
      "Sends event telemetry to PixieBrix"
    );
  }

  inputSchema: Schema = {
    type: "object",

    properties: {
      eventName: {
        type: "string",
        description: "A unique name for the event",
      },
      data: {
        type: "object",
        additionalProperties: true,
        description: "Data to send with the event",
      },
    },

    required: ["eventName"],
  };

  async effect({ eventName, data = {} }: BlockArg): Promise<void> {
    if ("$eventName" in data) {
      throw new PropError(
        "$eventName is a reserved value for eventName",
        this.id,
        "eventName",
        eventName
      );
    }
    reportEvent("CustomUserEvent", {
      $eventName: eventName,
      ...data,
    });
  }
}

registerBlock(new TelemetryEffect());
