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

import React, { useCallback } from "react";
import { connect } from "react-redux";
import { compact } from "lodash";
import GenericMarketplacePage from "@/pages/marketplace/MarketplacePage";
import { push } from "connected-react-router";
import { RecipeDefinition } from "@/types/definitions";
import { useTitle } from "@/hooks/title";
import { selectExtensions } from "@/options/selectors";
import { RegistryId } from "@/core";
import { OptionsState } from "@/store/extensions";

interface MarketplaceProps {
  installedRecipes: Set<RegistryId>;
  navigate: (url: string) => void;
}

const MarketplacePage: React.FunctionComponent<MarketplaceProps> = ({
  installedRecipes,
  navigate,
}) => {
  useTitle("Marketplace");

  const install = useCallback(
    async (x: RecipeDefinition) => {
      navigate(`marketplace/activate/${encodeURIComponent(x.metadata.id)}`);
    },
    [navigate]
  );

  return (
    <GenericMarketplacePage
      installedRecipes={installedRecipes}
      installRecipe={install}
    />
  );
};

export default connect(
  (state: { options: OptionsState }) => ({
    installedRecipes: new Set(
      compact(selectExtensions(state).map((x) => x._recipe?.id))
    ),
  }),
  { navigate: push }
)(MarketplacePage);
