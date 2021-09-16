/*
 * Copyright (C) 2021 PixieBrix, Inc.
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
import Centered from "@/devTools/editor/components/Centered";

const NoExtensionsPane: React.FunctionComponent<{
  unavailableCount: number;
}> = ({ unavailableCount }) => (
  <Centered isScrollable>
    <div className="PaneTitle">No custom extensions on the page</div>

    <div className="text-left">
      <p>
        Click <span className="text-info">Add</span> in the sidebar to add an
        element to the page.
      </p>

      <p>
        Check the &ldquo;Show {unavailableCount ?? 1} unavailable&rdquo; box to
        list extensions that are activated but aren&apos;t available on this
        page.
      </p>

      <p>
        Learn how to use the Page Editor in our{" "}
        <a
          href="https://docs.pixiebrix.com/quick-start-guide"
          target="_blank"
          rel="noopener noreferrer"
        >
          Quick Start Guide
        </a>
      </p>

      <p>
        Or, schedule a{" "}
        <a
          href="https://calendly.com/pixiebrix-todd/live-support-session"
          target="_blank"
          rel="noopener noreferrer"
        >
          FREE Zoom support session
        </a>
      </p>
    </div>
  </Centered>
);

export default NoExtensionsPane;
