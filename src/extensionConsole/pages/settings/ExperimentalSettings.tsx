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
// eslint-disable-next-line no-restricted-imports -- TODO: Fix over time
import { Card, Form } from "react-bootstrap";
import { useSelector } from "react-redux";
import { faFlask } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { selectSettings } from "@/store/settings/settingsSelectors";
import SettingToggle from "@/extensionConsole/pages/settings/SettingToggle";
import { isMV3 } from "@/mv3/api";
import useFlags from "@/hooks/useFlags";

const ExperimentalSettings: React.FunctionComponent = () => {
  const { flagOn } = useFlags();

  const {
    suggestElements,
    excludeRandomClasses,
    performanceTracing,
    sandboxedCode,
    selectionPopover,
    textCommandPopover,
  } = useSelector(selectSettings);

  return (
    <Card>
      <Card.Header>
        Skunkworks <FontAwesomeIcon icon={faFlask} />
      </Card.Header>
      <Card.Body>
        <Form>
          <SettingToggle
            controlId="suggestElements"
            label="Suggest Elements in Selection Mode"
            description="Toggle on to enable element suggestions/filtering in Page Editor
            selection mode"
            isEnabled={suggestElements}
            flag="suggestElements"
          />
          <SettingToggle
            controlId="excludeRandomClasses"
            label="Detect and Exclude Random Classes from Selectors"
            description="Toggle on to avoid using randomly-generated classes when picking
            elements from a website"
            isEnabled={excludeRandomClasses}
            flag="excludeRandomClasses"
          />
          <SettingToggle
            controlId="performanceTracing"
            label="Performance Tracing"
            description="Toggle on to trace runtime performance"
            isEnabled={performanceTracing}
            flag="performanceTracing"
          />
          {!isMV3() && (
            <SettingToggle
              controlId="sandboxedCode"
              label="Sandboxed Code"
              description="Toggle on to sandbox templating libraries"
              isEnabled={sandboxedCode}
              flag="sandboxedCode"
            />
          )}
          {flagOn("text-selection-popover-force") ? (
            // We're doing limited rollouts of the text selection popover via feature flag
            <SettingToggle
              controlId="selectionPopover"
              label="Selection Popover"
              description="Show context menu items in a selection popover."
              isEnabled={true}
              disabled={true}
              flag="selectionPopover"
            />
          ) : (
            <SettingToggle
              controlId="selectionPopover"
              label="Selection Popover"
              description="Show context menu items in a selection popover"
              isEnabled={selectionPopover}
              flag="selectionPopover"
            />
          )}
          <SettingToggle
            controlId="textCommandPopover"
            label="Text Command Popover"
            description="Show a text command popover"
            isEnabled={textCommandPopover}
            flag="textCommandPopover"
          />
        </Form>
      </Card.Body>
    </Card>
  );
};

export default ExperimentalSettings;
