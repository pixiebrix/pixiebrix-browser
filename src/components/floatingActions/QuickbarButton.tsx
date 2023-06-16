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

import React, { useState } from "react";
import logoUrl from "@/icons/custom-icons/logo.svg";
import { Button } from "react-bootstrap";
import { toggleQuickBar } from "@/components/quickBar/QuickBarApp";
import { reportEvent } from "@/telemetry/events";
import AsyncButton from "@/components/AsyncButton";
import { getSettingsState, saveSettingsState } from "@/store/settingsStorage";

/**
 * Opens the quickbar menu
 */
export function QuickbarButton() {
  // Using this boolean to hide the FAB since the setting state doesn't refresh immediately
  const [hidden, setHidden] = useState<boolean>(false);

  return hidden ? null : (
    // Using standard css here because the shadow dom in `FloatingActions.tsx`
    // prevents us from using regular css modules.
    <div className="quickbar-button-container">
      <div className="hide-button-container">
        <AsyncButton
          className="hide-button"
          onClick={async () => {
            try {
              setHidden(true);
              const settings = await getSettingsState();
              await saveSettingsState({
                ...settings,
                isFloatingActionButtonEnabled: false,
              });
              reportEvent("OnScreenHideFloatingQuickBarButton");
            } catch {
              setHidden(false);
            }
          }}
          variant="outline"
        >
          Hide Button
        </AsyncButton>
      </div>
      <div>
        <Button
          className="quickbar-button"
          onClick={() => {
            reportEvent("FloatingQuickBarButtonClick");
            toggleQuickBar();
          }}
        >
          {/* <img> tag since we're using a different svg than the <Logo> component and it overrides all the styles
              anyway */}
          <img
            src={logoUrl}
            className="logo"
            alt="open the PixieBrix quick bar"
          />
        </Button>
      </div>
    </div>
  );
}
