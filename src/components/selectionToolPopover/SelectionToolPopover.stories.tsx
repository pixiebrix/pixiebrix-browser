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
import { ComponentStory, ComponentMeta } from "@storybook/react";
import SelectionToolPopover from "@/components/selectionToolPopover/SelectionToolPopover";

/*
 * This Storybook component is unstyled because it's wrapped inside the react-shadow-dom.
 * It loads styles as url and inject as <style> tag but it doesn't work in storybook
 */
export default {
  title: "Components/SelectionToolPopover",
  component: SelectionToolPopover,
  argTypes: {},
} as ComponentMeta<typeof SelectionToolPopover>;

const Template: ComponentStory<typeof SelectionToolPopover> = (args) => (
  <div>
    <SelectionToolPopover {...args} setSelectionHandler={(handler) => {}} />
  </div>
);

export const Default = Template.bind({});
Default.args = {};
