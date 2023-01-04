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
import Page from "@/layout/Page";
import { type ComponentStory, type ComponentMeta } from "@storybook/react";

export default {
  component: Page,
  title: "Layout/Page",
} as ComponentMeta<typeof Page>;

const Template: ComponentStory<typeof Page> = (args) => (
  <Page {...args}>Hello world!</Page>
);

export const Default = Template.bind({});
Default.args = {
  icon: "music",
  title: "Example page",
  description: "Welcome to an example page! Have a look around.",
};

export const Loading = Template.bind({});
Loading.args = {
  icon: "music",
  title: "Example page",
  isPending: true,
  description: "Welcome to an example page! Have a look around.",
};
Loading.parameters = {
  // Loading indicator is an animation
  storyshots: false,
};

export const LoadError = Template.bind({});
LoadError.args = {
  icon: "music",
  title: "Example page",
  error: new Error("Error loading page"),
  description: "Welcome to an example page! Have a look around.",
};
