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
import { ResolvedExtension } from "@/core";
import {
  ExportBlueprintAction,
  RemoveAction,
} from "@/options/pages/installed/installedPageTypes";
import { groupBy, sortBy } from "lodash";
import { Card, Col, Row, Table } from "react-bootstrap";
import RecipeEntry from "@/options/pages/installed/RecipeEntry";

const ActiveBricksCard: React.FunctionComponent<{
  extensions: ResolvedExtension[];
  onRemove: RemoveAction;
  onExportBlueprint: ExportBlueprintAction;
}> = ({ extensions, onRemove, onExportBlueprint }) => {
  const recipeExtensions = useMemo(
    () =>
      sortBy(
        Object.entries(groupBy(extensions, (x) => x._recipe?.id ?? "")),
        ([recipeId]) => (recipeId === "" ? 0 : 1)
      ),
    [extensions]
  );

  return (
    <Row>
      <Col xl={9} lg={10} md={12}>
        <Card className="ActiveBricksCard">
          <Card.Header>Active Bricks</Card.Header>
          <Table>
            <thead>
              <tr>
                <th>&nbsp;</th>
                <th>Name</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            {recipeExtensions.map(([recipeId, xs]) => (
              <RecipeEntry
                key={recipeId}
                recipeId={recipeId}
                extensions={xs}
                onRemove={onRemove}
                onExportBlueprint={onExportBlueprint}
              />
            ))}
          </Table>
        </Card>
      </Col>
    </Row>
  );
};

export default ActiveBricksCard;
