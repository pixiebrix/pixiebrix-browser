/*
 * Copyright (C) 2022 PixieBrix, Inc.
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

import styles from "./GetStartedView.module.scss";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import { Col, Row } from "react-bootstrap";
import { isMac } from "@/utils";

const ExternalLink: React.VoidFunctionComponent<{
  linkText: string;
  url: string;
}> = ({ linkText, url }) => (
  <span>
    <a href={url} target="_blank" rel="noopener noreferrer">
      {linkText}
    </a>
    <FontAwesomeIcon
      icon={faExternalLinkAlt}
      className={styles.externalLinkIcon}
      size="xs"
    />
  </span>
);

const GetStartedView: React.VoidFunctionComponent<{
  width: number;
  height: number;
}> = ({ width, height }) => (
  <div
    style={{ height: `${height}px`, width: `${width}px` }}
    className={styles.root}
  >
    <Row className={styles.infoRow}>
      <Col>
        <h4>Want to create a new Blueprint?</h4>
        <ul>
          <li>
            Start by opening a new browser tab navigating to the webpage
            you&apos;d like to modify.
          </li>
          <li>
            Go to the PixieBrix tab via the <strong>Chrome DevTools</strong>{" "}
            using{" "}
            {isMac() ? (
              <kbd>Cmd + Option + C</kbd>
            ) : (
              <kbd>Ctrl + Shift + C</kbd>
            )}{" "}
            or <kbd>F12</kbd> and start editing your page.
          </li>
          <li>
            Save your Blueprint in the Page Editor and you&apos;ll see it show
            up here as a personal Blueprint.
          </li>
        </ul>
      </Col>
    </Row>
    <Row className={styles.infoRow}>
      <Col>
        <h4>Need more help?</h4>
        <p>
          Visit the{" "}
          <ExternalLink
            linkText="Quick Start Guide"
            url="https://docs.pixiebrix.com/quick-start-guide"
          />{" "}
          or ask questions in the{" "}
          <ExternalLink
            linkText="Slack Community"
            url="https://pixiebrixcommunity.slack.com/join/shared_invite/zt-13gmwdijb-Q5nVsSx5wRLmRwL3~lsDww#/shared-invite/email"
          />
          .
        </p>
        <p>
          {" "}
          Visit the{" "}
          <ExternalLink
            linkText="PixieBrix Marketplace"
            url="https://www.pixiebrix.com/marketplace/"
          />{" "}
          for ideas.
        </p>
      </Col>
    </Row>
  </div>
);

export default GetStartedView;
