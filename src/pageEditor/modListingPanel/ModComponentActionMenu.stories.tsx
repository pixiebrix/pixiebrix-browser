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
import ModComponentActionMenu from "@/pageEditor/modListingPanel/ModComponentActionMenu";
import { type ComponentMeta, type ComponentStory } from "@storybook/react";
import { editorStore } from "@/testUtils/storyUtils";
import { Provider } from "react-redux";
import { triggerFormStateFactory } from "@/testUtils/factories/pageEditorFactories";

export default {
  title: "Sidebar/ActionMenu",
  component: ModComponentActionMenu,
  argTypes: {
    modComponentFormState: {
      control: "object",
      defaultValue: triggerFormStateFactory(),
    },
  },
} as ComponentMeta<typeof ModComponentActionMenu>;

const Template: ComponentStory<typeof ModComponentActionMenu> = (args) => (
  <div className="d-flex">
    <Provider store={editorStore()}>
      <ModComponentActionMenu {...args} />
    </Provider>
  </div>
);

export const NewModComponent = Template.bind({});
NewModComponent.args = {
  modComponentFormState: triggerFormStateFactory(),
};

export const OldModComponent = Template.bind({});
OldModComponent.args = {
  modComponentFormState: triggerFormStateFactory(),
};

export const Mod = Template.bind({});
Mod.args = {
  modComponentFormState: triggerFormStateFactory(),
};

export const NewModComponentInMod = Template.bind({});
NewModComponentInMod.args = {
  modComponentFormState: triggerFormStateFactory(),
};

export const OldModComponentInMod = Template.bind({});
OldModComponentInMod.args = {
  modComponentFormState: triggerFormStateFactory(),
};
