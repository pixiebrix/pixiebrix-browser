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

import React from "react";
import ListView from "@/options/pages/blueprints/listView/ListView";
import GridView from "@/options/pages/blueprints/gridView/GridView";
import { useSelector } from "react-redux";
import { selectView } from "@/options/pages/blueprints/blueprintsSelectors";
import { BlueprintListViewProps } from "@/options/pages/blueprints/blueprintsTypes";

const BlueprintsView: React.VoidFunctionComponent<BlueprintListViewProps> = ({
  tableInstance,
  width,
  height,
}) => {
  const view = useSelector(selectView);
  const BlueprintsList = view === "list" ? ListView : GridView;

  // if no tableInstance rows
  //    - if on "Active Blueprints" page
  //          - show onboarding page
  //    - if global search query'
  //          - show "empty search results" page
  //    - if on "personal" page
  //          - prompt user to create blueprints
  //    - if on team page
  //          ...
  //     etc.

  // hasOrganization
  // hasDeployments
  // isRestricted
  // hasTeamBlueprints

  return (
    <BlueprintsList
      tableInstance={tableInstance}
      width={width}
      height={height}
    />
  );
};

export default BlueprintsView;
