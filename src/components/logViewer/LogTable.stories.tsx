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

import { ContextError } from "@/errors/genericErrors";
import React from "react";
import { type ComponentStory, type ComponentMeta } from "@storybook/react";
import { validateRegistryId, uuidv4 } from "@/types/helpers";
import LogTable from "@/components/logViewer/LogTable";
import { serializeError } from "serialize-error";
import { Card } from "react-bootstrap";
import { InputValidationError } from "@/bricks/errors";
import { type Schema } from "@/types/schemaTypes";
import type { LogEntry } from "@/telemetry/logging";

Object.assign(global, { chrome: { runtime: { id: 42 } } });

export default {
  title: "Editor/LogTable",
  component: LogTable,
} as ComponentMeta<typeof LogTable>;

const Template: ComponentStory<typeof LogTable> = (args) => (
  <Card>
    <Card.Header>Error Log</Card.Header>
    <Card.Body className="p-0">
      <LogTable {...args} />
    </Card.Body>
  </Card>
);

export const NoEntries = Template.bind({});
NoEntries.args = {
  hasEntries: false,
  pageEntries: [],
};

export const NoEntriesForLevel = Template.bind({});
NoEntriesForLevel.args = {
  hasEntries: true,
  pageEntries: [],
};

const blockId = validateRegistryId("@pixiebrix/system/notification");

// Constant date to support storyshots
const MESSAGE_DATE = Date.parse("04 Dec 2022 00:12:00 GMT");

const DEBUG_MESSAGE: LogEntry = {
  uuid: uuidv4(),
  timestamp: MESSAGE_DATE.toString(),
  message: "Sample debug message",
  level: "debug",
  context: {
    blockId,
  },
};

const ERROR_MESSAGE: LogEntry = {
  uuid: uuidv4(),
  timestamp: MESSAGE_DATE.toString(),
  message: "Sample error running brick message",
  level: "error",
  context: {
    // Just the context that will show up in the table
    blockId,
  },
  error: serializeError(new Error("Simple error")),
};

const NESTED_ERROR_MESSAGE: LogEntry = {
  uuid: uuidv4(),
  timestamp: MESSAGE_DATE.toString(),
  message: "Sample error with cause chain",
  level: "error",
  context: {
    // Just the context that will show up in the table
    blockId,
  },
  error: serializeError(
    new Error("Simple error", {
      cause: new Error("Cause error", { cause: new Error("Cause error #2") }),
    })
  ),
};

const sampleSchema: Schema = {
  type: "object",
  properties: {
    query: {
      type: "string",
    },
  },
};

const validationError = new InputValidationError(
  "Invalid inputs for block",
  sampleSchema,
  {},
  [
    {
      error: 'Instance does not have required property "query".',
      instanceLocation: "#",
      keyword: "required",
      keywordLocation: "#/required",
    },
  ]
);

const CONTEXT_ERROR_MESSAGE: LogEntry = {
  uuid: uuidv4(),
  timestamp: MESSAGE_DATE.toString(),
  message: "Invalid inputs for block",
  level: "error",
  context: {
    // Just the context that will show up in the table
    blockId,
  },
  error: serializeError(
    new ContextError("Invalid inputs for block", {
      cause: validationError,
      context: {
        blockId,
      },
    })
  ),
};

export const Populated = Template.bind({});
Populated.args = {
  hasEntries: true,
  pageEntries: [
    DEBUG_MESSAGE,
    ERROR_MESSAGE,
    NESTED_ERROR_MESSAGE,
    CONTEXT_ERROR_MESSAGE,
  ],
};
