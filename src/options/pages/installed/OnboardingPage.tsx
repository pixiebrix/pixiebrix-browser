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

import React, { useContext, useMemo } from "react";
import { Button, Card, Col, Row } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import AuthContext from "@/auth/AuthContext";
import { Link } from "react-router-dom";
import { useGetOrganizationsQuery, useGetRecipesQuery } from "@/services/api";
import useDeployments from "@/hooks/useDeployments";
import GridLoader from "react-spinners/GridLoader";

const ActivateFromMarketplaceColumn: React.FunctionComponent = () => (
  <Col xs={6}>
    <h4>Activate an Official Blueprint</h4>
    <p>
      <span className="text-primary">
        The easiest way to start using PixieBrix!
      </span>{" "}
      Activate a pre-made blueprint from the Marketplace.
    </p>
    <Button
      href="https://pixiebrix.com/marketplace/"
      variant="info"
      target="_blank"
    >
      <FontAwesomeIcon icon={faExternalLinkAlt} /> &nbsp;Browse the Marketplace
    </Button>
  </Col>
);

const ActivateTeamBlueprintsColumn: React.FunctionComponent = () => (
  <Col xs={6}>
    <h4>Activate Team Blueprints</h4>
    <p>Browse and activate team bricks in the My Blueprints page.</p>
    <Link to="/blueprints" className="btn btn-info">
      Open My Blueprints
    </Link>
  </Col>
);

const ActivateFromDeploymentBannerColumn: React.FunctionComponent = () => (
  <Col>
    <h4>You have Team Bricks ready to activate!</h4>
    <p className="mb-0">
      Click the <strong className="text-primary">Activate</strong> button in the{" "}
      <strong className="text-info">blue banner above</strong> to start using
      your team bricks. You will see this banner every time your team deploys
      new or updated bricks for you to use.
    </p>
  </Col>
);

const ContactTeamAdminColumn: React.FunctionComponent = () => (
  <Col xs={6}>
    <h4>Activate Team Blueprints</h4>
    <p className="mb-0">
      It looks like your team hasn&apos;t made any bricks available to you yet.
      <strong>Contact your team admin</strong> to get access to your team&apos;s
      bricks.
    </p>
  </Col>
);

const CreateBrickColumn: React.FunctionComponent = () => (
  <Col xs={6}>
    <h4>Create your Own</h4>
    <p>
      Follow the Quickstart Guide in our documentation area to start creating
      your own bricks in minutes.
    </p>
    <a
      className="btn btn-info"
      href="https://docs.pixiebrix.com/quick-start-guide"
      target="_blank"
      rel="noopener noreferrer"
    >
      <FontAwesomeIcon icon={faExternalLinkAlt} /> &nbsp;Open Quickstart Guide
    </a>
  </Col>
);

const OnboardingVideoCard: React.FunctionComponent = () => (
  <Card>
    <Card.Header>Video Tour</Card.Header>
    <Card.Body className="mx-auto">
      <div>
        <iframe
          title="onboarding-video"
          src="https://player.vimeo.com/video/514828533"
          width="640"
          height="400"
          frameBorder="0"
          allow="fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    </Card.Body>
  </Card>
);

const OnboardingPage: React.FunctionComponent = () => {
  const { flags } = useContext(AuthContext);
  const {
    data: rawRecipes,
    isLoading: isRecipesLoading,
  } = useGetRecipesQuery();
  const {
    data: organizations,
    isLoading: isOrganizationsLoading,
  } = useGetOrganizationsQuery();
  const {
    hasUpdate: hasDeployments,
    isLoading: isDeploymentsLoading,
  } = useDeployments();

  const teamRecipes = (rawRecipes ?? []).filter(
    (recipe) => recipe.sharing.organizations.length > 0
  );

  const hasTeamBlueprints = teamRecipes?.length > 0;
  const hasOrganization = organizations?.length > 0;
  const isLoading =
    isRecipesLoading || isOrganizationsLoading || isDeploymentsLoading;

  // Video tour should be shown to typical users and enterprise users
  //  that don't have deployments or marketplace restrictions
  const showVideoTour = useMemo(
    () =>
      !hasOrganization ||
      (!hasDeployments && !flags.includes("restricted-marketplace")),
    [hasOrganization, hasDeployments, flags]
  );

  const onBoardingInformation = useMemo(() => {
    if (hasOrganization) {
      if (hasDeployments) {
        return <ActivateFromDeploymentBannerColumn />;
      }

      if (flags.includes("restricted-marketplace")) {
        return <ContactTeamAdminColumn />;
      }

      if (hasTeamBlueprints) {
        return (
          <>
            <ActivateTeamBlueprintsColumn />
            <CreateBrickColumn />
          </>
        );
      }
    }

    return (
      <>
        <ActivateFromMarketplaceColumn />
        <CreateBrickColumn />
      </>
    );
  }, [hasOrganization, hasDeployments, hasTeamBlueprints, flags]);

  return (
    <>
      {isLoading ? (
        <div id="OnboardingSpinner">
          <GridLoader />
        </div>
      ) : (
        <>
          <Row>
            <Col className="VideoCard">
              <Card>
                <Card.Header>Activate Bricks</Card.Header>
                <Card.Body>
                  <Row>{onBoardingInformation}</Row>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          {showVideoTour && (
            <Row>
              <Col className="VideoCard mt-3">
                <OnboardingVideoCard />
              </Col>
            </Row>
          )}
        </>
      )}
    </>
  );
};

export default OnboardingPage;
