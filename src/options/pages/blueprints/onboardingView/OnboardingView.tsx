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

import styles from "./OnboardingView.module.scss";

import React, { useMemo } from "react";
import { Button, Card, Col, Row } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import marketplaceImage from "@img/marketplace.svg";
import { type OnboardingType } from "@/options/pages/blueprints/onboardingView/useOnboarding";
import blueprintsSlice from "@/options/pages/blueprints/blueprintsSlice";
import { useDispatch } from "react-redux";
import workshopImage from "@img/workshop.svg";
import { BLUEPRINTS_PAGE_TABS } from "@/options/pages/blueprints/ListFilters";

const ActivateFromMarketplaceColumn: React.VoidFunctionComponent = () => (
  <Col className="d-flex justify-content-center flex-column text-center">
    <p>
      <span className="text-primary">Not sure what to build?</span> Activate a
      pre-made blueprints from the public marketplace, or just peruse for
      inspiration.
    </p>
    <div className="align-self-center">
      <a
        className="btn btn-primary"
        href="https://pixiebrix.com/marketplace/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <FontAwesomeIcon icon={faExternalLinkAlt} /> Visit the Marketplace
      </a>
    </div>
  </Col>
);

const ActivateTeamBlueprintsColumn: React.VoidFunctionComponent = () => {
  const { setActiveTab } = blueprintsSlice.actions;
  const dispatch = useDispatch();

  return (
    <Col xs={6}>
      <h4>Activate Team Blueprints</h4>
      <p>
        You can browse blueprints shared with you using the category filters on
        this page.
      </p>
      <Button
        size="sm"
        onClick={() => {
          dispatch(setActiveTab(BLUEPRINTS_PAGE_TABS.all));
        }}
      >
        View my blueprints
      </Button>
    </Col>
  );
};

const ActivateFromDeploymentBannerColumn: React.VoidFunctionComponent = () => (
  <Col>
    <p>
      Click the <strong className="text-primary">Activate</strong> button in the{" "}
      <strong className="text-info">blue banner above</strong> to start using
      your team blueprints. You will see this banner every time your team
      deploys new or updated blueprints for you to use.
    </p>
  </Col>
);

const ContactTeamAdminColumn: React.VoidFunctionComponent = () => (
  <Col>
    <p>
      It looks like your team hasn&apos;t made any blueprints available to you
      yet. <strong>Contact your team admin</strong> to get access to your
      team&apos;s blueprints.
    </p>
  </Col>
);

const UnaffiliatedColumn: React.VoidFunctionComponent = () => (
  <Col className="d-flex justify-content-center flex-column text-center">
    <p>
      Learn how to create your own extensions in minutes by following our{" "}
      <span className="text-primary">step-by-step guide</span>.
    </p>
    <div className="align-self-center">
      <a
        className="btn btn-primary"
        href="https://docs.pixiebrix.com/quick-start-guide"
        target="_blank"
        rel="noopener noreferrer"
      >
        <FontAwesomeIcon icon={faExternalLinkAlt} /> Get started
      </a>
    </div>
  </Col>
);

const CreateBrickColumn: React.VoidFunctionComponent = () => (
  <Col>
    <h4>Create your Own</h4>
    <p>
      Learn how to create your own extensions in minutes by following our
      step-by-step guide.
    </p>
    <a
      className="btn btn-info btn-sm"
      href="https://docs.pixiebrix.com/quick-start-guide"
      target="_blank"
      rel="noopener noreferrer"
    >
      <FontAwesomeIcon icon={faExternalLinkAlt} /> Get started
    </a>
  </Col>
);

const OnboardingView: React.VoidFunctionComponent<{
  onboardingType: OnboardingType;
  isLoading: boolean;
  filter?: string;
  width: number;
  height: number;
}> = ({ onboardingType, filter, isLoading, width, height }) => {
  const onBoardingInformation = useMemo(() => {
    if (!(onboardingType === "restricted") && filter === "public") {
      return <ActivateFromMarketplaceColumn />;
    }

    if (!(onboardingType === "restricted") && filter === "personal") {
      return <UnaffiliatedColumn />;
    }

    switch (onboardingType) {
      case "hasDeployments": {
        return <ActivateFromDeploymentBannerColumn />;
      }

      case "restricted": {
        return <ContactTeamAdminColumn />;
      }

      case "hasTeamBlueprints": {
        return (
          <>
            <ActivateTeamBlueprintsColumn />
            <CreateBrickColumn />
          </>
        );
      }

      default: {
        return <UnaffiliatedColumn />;
      }
    }
  }, [filter, onboardingType]);

  const onboardingCallout = useMemo(() => {
    switch (onboardingType) {
      case "restricted": {
        return "Welcome to PixieBrix! Ready to get started?";
      }

      default: {
        if (filter === "personal") {
          return "Create your own extensions";
        }

        if (filter === "public") {
          return "Discover pre-made blueprints in the public marketplace";
        }

        return "Welcome to PixieBrix! Ready to get started?";
      }
    }
  }, [filter, onboardingType]);

  const headerImage =
    filter === "personal" ? (
      <img src={workshopImage} alt="Workshop" width={300} />
    ) : (
      <img src={marketplaceImage} alt="Marketplace" width={300} />
    );

  return (
    <div style={{ height: `${height}px`, width: `${width}px` }}>
      <Card className={styles.root}>
        <Card.Body className={styles.cardBody}>
          {headerImage}
          <h3 className="mb-4 text-center">{onboardingCallout}</h3>
          {!isLoading && <Row>{onBoardingInformation}</Row>}
        </Card.Body>
      </Card>
    </div>
  );
};

export default OnboardingView;
