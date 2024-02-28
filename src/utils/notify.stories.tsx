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
import { type ComponentStory, type ComponentMeta } from "@storybook/react";
import { Button } from "react-bootstrap";
import { initToaster, showNotification } from "./notify";
import type { NotificationType } from "@/utils/notificationTypes";

const notificationTypes = ["info", "success", "error", "warning", "loading"];
initToaster();

const NotifyButton = ({ type }: { type: NotificationType }) => (
  <Button
    variant="primary"
    onClick={() => {
      showNotification({
        message: type,
        type,
      });
    }}
  >
    Show notification
  </Button>
);

export default {
  title: "Common/notify",
  component: NotifyButton,
  argTypes: {
    type: {
      options: notificationTypes,
      control: { type: "select" },
    },
  },
} as ComponentMeta<typeof NotifyButton>;

export const Default: ComponentStory<typeof NotifyButton> = (args) => (
  <NotifyButton {...args} />
);
Default.args = {
  type: "info",
};
