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
import { Button } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCommentAlt, faPhone } from "@fortawesome/free-solid-svg-icons";

const WelcomePane: React.FunctionComponent<{ showSupport: () => void }> = ({
  showSupport,
}) => (
  <Centered isScrollable>
    <div className="PaneTitle">Welcome to the PixieBrix Page Editor!</div>

    <div className="text-left">
      <p>Click Add in the sidebar to add an element to the page.</p>

      <p>
        Learn how to use the Page Editor in our{" "}
        <a
          href="https://docs.pixiebrix.com/quick-start-guide"
          target="_blank"
          rel="noreferrer"
        >
          Quick Start Guide
        </a>
      </p>

      <div className="text-center">
        <Button variant="info" onClick={showSupport}>
          <FontAwesomeIcon icon={faCommentAlt} /> Live Chat Support
        </Button>

        <Button
          className="ml-2"
          variant="info"
          href="https://calendly.com/pixiebrix-todd/live-support-session"
          target="_blank"
        >
          <FontAwesomeIcon icon={faPhone} /> Schedule FREE Zoom Session
        </Button>
      </div>
    </div>
  </Centered>
);

export default WelcomePane;
