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

import React, { useEffect } from "react";
import reportEvent from "@/telemetry/reportEvent";
import { Events } from "@/telemetry/events";
import {
  DISPLAY_REASON_EXTENSION_CONSOLE,
  DISPLAY_REASON_UNKNOWN,
} from "@/tinyPages/restrictedUrlPopupConstants";
import { isBrowserSidebar } from "@/utils/expectContext";

const RestrictedUrlContent: React.FC = ({ children }) => (
  <div className="p-3">
    {children}
    <div className="mt-2">
      To open the PixieBrix Sidebar, navigate to a website and then click the
      PixieBrix toolbar icon again.
    </div>
    <hr />

    <div className="mt-2">
      Looking for the Page Editor?{" "}
      <a
        href="https://www.pixiebrix.com/developers-welcome"
        onClick={async (event) => {
          if (event.shiftKey || event.ctrlKey || event.metaKey) {
            return;
          }

          event.preventDefault();
          await browser.tabs.update({
            url: event.currentTarget.href,
          });

          // TODO: Drop after restrictedUrlPopup.html is removed
          if (!isBrowserSidebar()) {
            window.close();
          }
        }}
      >
        View the Developer Welcome Page
      </a>
    </div>
  </div>
);

const RestrictedUrlPopupApp: React.FC<{ reason: string | null }> = ({
  reason = DISPLAY_REASON_UNKNOWN,
}) => {
  useEffect(() => {
    reportEvent(Events.BROWSER_ACTION_RESTRICTED_URL, {
      reason,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run once on mount
  }, []);

  return reason === DISPLAY_REASON_EXTENSION_CONSOLE ? (
    <RestrictedUrlContent>
      <div className="font-weight-bold">This is the Extension Console.</div>
      <div className="mt-2">PixieBrix mods cannot run on this page.</div>
    </RestrictedUrlContent>
  ) : (
    <RestrictedUrlContent>
      <div className="font-weight-bold">This is a restricted browser page.</div>
      <div className="mt-2">PixieBrix cannot access this page.</div>
    </RestrictedUrlContent>
  );
};

export default RestrictedUrlPopupApp;
