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
// eslint-disable-next-line no-restricted-imports -- TODO: Fix over time
import { Card, Form } from "react-bootstrap";
import BootstrapSwitchButton from "bootstrap-switch-button-react";
import settingsSlice from "@/store/settingsSlice";
import { useDispatch, useSelector } from "react-redux";
import { selectSettings } from "@/store/settingsSelectors";
import reportEvent from "@/telemetry/reportEvent";
import { Events } from "@/telemetry/events";
import useIsEnterpriseUser from "@/hooks/useIsEnterpriseUser";

const GeneralSettings: React.FunctionComponent = () => {
  const dispatch = useDispatch();
  const { isFloatingActionButtonEnabled } = useSelector(selectSettings);

  // Disable FAB for enterprise and partner users
  const disableFloatingActionButton = useIsEnterpriseUser();

  const checked = isFloatingActionButtonEnabled && !disableFloatingActionButton;

  return (
    <Card>
      <Card.Header>General Settings</Card.Header>
      <Card.Body>
        <Form>
          <Form.Group controlId="floating-action-button">
            <div>
              <Form.Label>
                Floating action button:{" "}
                <i>{checked ? "Enabled" : "Disabled"}</i>
              </Form.Label>
              {disableFloatingActionButton ? (
                <Form.Text muted className="mb-2">
                  The floating action button is not available for enterprise and
                  partner users
                </Form.Text>
              ) : (
                <Form.Text muted className="mb-2">
                  Toggle on to enable floating button that opens the Quick Bar
                </Form.Text>
              )}
            </div>

            {
              // Hide because the disabled flag is not working. Even when disabled is true, the user can
              // still toggle the switch :shrug:
              !disableFloatingActionButton && (
                <BootstrapSwitchButton
                  size="sm"
                  onstyle="info"
                  offstyle="light"
                  onlabel=" "
                  offlabel=" "
                  disabled={disableFloatingActionButton}
                  checked={checked}
                  onChange={(enable) => {
                    reportEvent(
                      Events.FLOATING_QUICK_BAR_BUTTON_TOGGLE_SETTING,
                      {
                        enabled: enable,
                      }
                    );
                    dispatch(
                      settingsSlice.actions.setFloatingActionButtonEnabled(
                        enable
                      )
                    );
                  }}
                />
              )
            }
          </Form.Group>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default GeneralSettings;
