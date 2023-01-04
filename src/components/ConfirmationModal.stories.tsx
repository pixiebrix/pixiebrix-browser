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

import React, { type ComponentProps, useCallback } from "react";
import { type ComponentMeta, type Story } from "@storybook/react";
import AsyncButton from "./AsyncButton";
import { ModalProvider, useModals } from "@/components/ConfirmationModal";

export default {
  title: "Components/ConfirmationModal",
  component: ModalProvider,
  // Modals are not compatible with Storyshots
  parameters: {
    storyshots: false,
  },
} as ComponentMeta<typeof ModalProvider>;

type StoryType = ComponentProps<typeof ModalProvider> & {
  title?: string;
  message?: string;
  submitCaption?: string;
  cancelCaption?: string;
};
type ChildComponentType = {
  title?: string;
  message?: string;
  submitCaption?: string;
  cancelCaption?: string;
};
const ChildComponent = ({
  title,
  message,
  submitCaption,
  cancelCaption,
}: ChildComponentType) => {
  const { showConfirmation } = useModals();
  const buttonAction = useCallback(async () => {
    await showConfirmation({
      title,
      message,
      submitCaption,
      cancelCaption,
    });

    // Do any action here if confirm === true
  }, [showConfirmation]);
  return <AsyncButton onClick={buttonAction}>Confirm Modal</AsyncButton>;
};

const Template: Story<StoryType> = (args) => {
  const { title, message, submitCaption, cancelCaption } = args;

  return (
    <ModalProvider {...args}>
      <ChildComponent
        title={title}
        message={message}
        submitCaption={submitCaption}
        cancelCaption={cancelCaption}
      />
    </ModalProvider>
  );
};

export const DefaultContent = Template.bind({});
DefaultContent.args = null;

export const CustomContent = Template.bind({});
CustomContent.args = {
  title: "Delete campaign?",
  message:
    "Are you sure you want to delete campaign? This action cannot be undone.",
  submitCaption: "Yes, delete it",
  cancelCaption: "Back to safety",
};
