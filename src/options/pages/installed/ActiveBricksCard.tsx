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

import React, { useMemo } from "react";
import { MessageContext, ResolvedExtension, UUID } from "@/core";
import { ExportBlueprintAction, RemoveAction } from "./installedPageTypes";
import { Card, Col, Row, Table } from "react-bootstrap";
import ExtensionGroup from "./ExtensionGroup";
import ExtensionGroupHeader from "./ExtensionGroupHeader";
import { groupBy } from "lodash";
import ExtensionRows from "./ExtensionRows";
import { isDeploymentActive } from "@/options/deploymentUtils";
import { useGetOrganizationsQuery } from "@/services/api";

const groupByRecipe = (
  extensions: ResolvedExtension[]
): ResolvedExtension[][] =>
  Object.values(groupBy(extensions, (extension) => extension._recipe.id));

const ActiveBricksCard: React.FunctionComponent<{
  extensions: ResolvedExtension[];
  onRemove: RemoveAction;
  onExportBlueprint: ExportBlueprintAction;
}> = ({ extensions, onRemove, onExportBlueprint }) => {
  const { data: organizations = [], isLoading } = useGetOrganizationsQuery();

  const personalExtensions = extensions.filter(
    (extension) => !extension._recipe && !extension._deployment
  );

  const marketplaceExtensionGroups = groupByRecipe(
    extensions.filter(
      (extension) =>
        extension._recipe &&
        extension._recipe.sharing?.organizations.length === 0 &&
        !extension._deployment
    )
  );

  const getOrganizationName = (organization_uuid: UUID) =>
    organizations.find((organization) => organization.id === organization_uuid)
      ?.name;

  const teamExtensionGroups = useMemo(() => {
    const teamExtensionGroups = extensions.filter(
      (extension) =>
        extension._recipe &&
        extension._recipe.sharing?.organizations.length > 0 &&
        !extension._deployment
    );

    console.log("Team extension groups:", teamExtensionGroups);

    return groupBy(
      teamExtensionGroups,
      (extension) => extension._recipe.sharing.organizations[0]
    );
  }, [extensions, organizations]);

  const deploymentGroups = groupByRecipe(
    extensions.filter((extension) => extension._deployment)
  );

  console.log("Organizations", organizations);
  console.log("Team extension groups:", teamExtensionGroups);

  return (
    <Row>
      <Col xl={9} lg={10} md={12}>
        <Card className="ActiveBricksCard">
          <Card.Header>Active Bricks</Card.Header>
          <Table>
            <tbody>
              {personalExtensions.length > 0 && (
                <>
                  <ExtensionGroupHeader label="Personal Bricks" />
                  <ExtensionRows
                    extensions={personalExtensions}
                    onRemove={onRemove}
                    onExportBlueprint={onExportBlueprint}
                  />
                </>
              )}

              {marketplaceExtensionGroups.length > 0 && (
                <>
                  <ExtensionGroupHeader label="Public Marketplace Bricks" />
                  {marketplaceExtensionGroups.map((extensions) => {
                    const recipe = extensions[0]._recipe;
                    const messageContext: MessageContext = {
                      blueprintId: recipe.id,
                    };

                    return (
                      <ExtensionGroup
                        key={recipe.id}
                        label={recipe.name}
                        extensions={extensions}
                        groupMessageContext={messageContext}
                        onRemove={onRemove}
                        onExportBlueprint={onExportBlueprint}
                      />
                    );
                  })}
                </>
              )}

              {Object.entries(teamExtensionGroups).map(
                ([organization_uuid, extensions], _) => {
                  const recipe = extensions[0]._recipe;
                  const messageContext: MessageContext = {
                    blueprintId: recipe.id,
                  };

                  return (
                    <>
                      <ExtensionGroupHeader
                        label={`${getOrganizationName(
                          organization_uuid as UUID
                        )} Bricks`}
                      />
                      <ExtensionGroup
                        key={recipe.id}
                        label={recipe.name}
                        extensions={extensions}
                        groupMessageContext={messageContext}
                        onRemove={onRemove}
                        onExportBlueprint={onExportBlueprint}
                      />
                    </>
                  );
                }
              )}

              {deploymentGroups.length > 0 && (
                <>
                  <ExtensionGroupHeader label="Automatic Team Deployments" />
                  {deploymentGroups.map((extensions) => {
                    const recipe = extensions[0]._recipe;
                    const deployment = extensions[0]._deployment;
                    const messageContext: MessageContext = {
                      blueprintId: recipe.id,
                      deploymentId: deployment.id,
                    };

                    return (
                      <ExtensionGroup
                        key={extensions[0]._recipe.id}
                        label={extensions[0]._recipe.name}
                        extensions={extensions}
                        managed
                        paused={!isDeploymentActive(extensions[0])}
                        groupMessageContext={messageContext}
                        onRemove={onRemove}
                        onExportBlueprint={onExportBlueprint}
                      />
                    );
                  })}
                </>
              )}
            </tbody>
          </Table>
        </Card>
      </Col>
    </Row>
  );
};

export default ActiveBricksCard;
