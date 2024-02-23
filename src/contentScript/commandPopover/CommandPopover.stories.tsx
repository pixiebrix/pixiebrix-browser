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

import type { ComponentMeta, ComponentStory } from "@storybook/react";
import React, { useLayoutEffect, useRef, useState } from "react";
import { uuidv4 } from "@/types/helpers";
import { action } from "@storybook/addon-actions";
import CommandPopover from "@/contentScript/commandPopover/CommandPopover";
import CommandRegistry from "@/contentScript/commandPopover/CommandRegistry";
import { sleep } from "@/utils/timeUtils";
import type { Nullishable } from "@/utils/nullishUtils";

export default {
  title: "Enhancements/CommandPopover",
  component: CommandPopover,
} as ComponentMeta<typeof CommandPopover>;

const Template: ComponentStory<typeof CommandPopover> = ({ registry }) => {
  const elementRef = useRef(null);
  const [element, setElement] = useState<Nullishable<HTMLElement>>(null);

  // Detect when the ref becomes available
  useLayoutEffect(() => {
    setElement(elementRef.current);
  }, [setElement]);

  return (
    <>
      <div>
        <textarea id="textArea" ref={elementRef} rows={4} cols={50} />
      </div>
      {element && (
        <div>
          <CommandPopover
            registry={registry}
            element={element}
            onHide={action("hide")}
          />
        </div>
      )}
    </>
  );
};

const emailCommand = {
  componentId: uuidv4(),
  shortcut: "email",
  title: "email",
  async handler() {
    return "david@pixiebrix.com";
  },
};

const timestampCommand = {
  componentId: uuidv4(),
  shortcut: "timestamp",
  title: "timestamp",
  async handler() {
    return Date.now().toString(10);
  },
};

const emojiCommand = {
  componentId: uuidv4(),
  shortcut: "emoji",
  title: "emoji",
  async handler() {
    return "🧱";
  },
};

const slowErrorCommand = {
  componentId: uuidv4(),
  shortcut: "error",
  title: "error",
  async handler() {
    await sleep(3000);
    throw new Error("This is a slow error");
  },
};

const commandRegistry = new CommandRegistry();
commandRegistry.register(emailCommand);
commandRegistry.register(timestampCommand);
commandRegistry.register(emojiCommand);
commandRegistry.register(slowErrorCommand);

/**
 * Demo of the CommandPopover component to test/verify the query and command handling.
 */
export const Demo = Template.bind({});
Demo.args = {
  registry: commandRegistry,
  onHide: action("onHide"),
  // XXX: fix Storybook parameter type instead of passing undefined
  element: undefined!,
};
