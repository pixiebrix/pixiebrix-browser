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

import React, { type ComponentProps } from "react";
import { type ComponentMeta, type Story } from "@storybook/react";
import IntegrationEditorModal from "./IntegrationEditorModal";
import { action } from "@storybook/addon-actions";
import { fromJS } from "@/services/factory";
import { dumpBrickYaml, loadBrickYaml } from "@/runtime/brickYaml";
import { type IntegrationDefinition } from "@/types/integrationTypes";

import pipedriveYaml from "@contrib/integrations/pipedrive.yaml?loadAsText";
import automationAnywhereYaml from "@contrib/integrations/automation-anywhere.yaml?loadAsText";
import registerDefaultWidgets from "@/components/fields/schemaFields/widgets/registerDefaultWidgets";
import { settingsStore } from "@/testUtils/storyUtils";
import { Provider } from "react-redux";

const FIXTURES = {
  pipedrive: pipedriveYaml,
  automationAnywhere: automationAnywhereYaml,
};

type StoryType = ComponentProps<typeof IntegrationEditorModal> & {
  fixture: keyof typeof FIXTURES;
};

export default {
  title: "Options/ServiceEditorModal",
  component: IntegrationEditorModal,
  // Modals are not compatible with Storyshots
  parameters: {
    storyshots: false,
  },
} as ComponentMeta<typeof IntegrationEditorModal>;

const Template: Story<StoryType> = ({ fixture, ...args }) => {
  const service = fromJS(
    // eslint-disable-next-line security/detect-object-injection -- type checked from fixture object
    loadBrickYaml(dumpBrickYaml(FIXTURES[fixture])) as IntegrationDefinition
  );

  // Cheap call, just call in the render function
  registerDefaultWidgets();

  return (
    <Provider store={settingsStore()}>
      <IntegrationEditorModal {...args} integration={service} />
    </Provider>
  );
};

export const Pipedrive = Template.bind({});
Pipedrive.args = {
  fixture: "pipedrive",
  onDelete: action("onDelete"),
  onClose: action("onClose"),
  async onSave() {
    action("onSave");
  },
};

export const AutomationAnywhere = Template.bind({});
AutomationAnywhere.args = {
  fixture: "automationAnywhere",
  onDelete: action("onDelete"),
  onClose: action("onClose"),
  async onSave() {
    action("onSave");
  },
};
