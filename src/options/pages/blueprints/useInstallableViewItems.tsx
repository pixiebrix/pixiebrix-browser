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

import {
  Installable,
  InstallableStatus,
  InstallableViewItem,
  SharingSource,
  SharingType,
} from "@/options/pages/blueprints/blueprintsTypes";
import React, { useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { selectExtensions } from "@/store/extensionsSelectors";
import { UUID } from "@/core";

import {
  getDescription,
  getInstalledVersionNumber,
  getLabel,
  getOrganization,
  getPackageId,
  getUpdatedAt,
  isExtension,
  isPersonal,
  isPublic,
  updateAvailable,
} from "@/options/pages/blueprints/utils/installableUtils";
import {
  useGetMarketplaceListingsQuery,
  useGetRecipesQuery,
} from "@/services/api";
import { MarketplaceListing } from "@/types/contract";
import InstallableIcon from "@/options/pages/blueprints/InstallableIcon";
import { selectOrganizations, selectScope } from "@/auth/authSelectors";
import { isDeploymentActive } from "@/utils/deployment";

function useInstallableViewItems(installables: Installable[]): {
  installableViewItems: InstallableViewItem[];
  isLoading: boolean;
} {
  const scope = useSelector(selectScope);
  const installedExtensions = useSelector(selectExtensions);
  const listings = useGetMarketplaceListingsQuery();
  const recipes = useGetRecipesQuery();
  const organizations = useSelector(selectOrganizations);

  const { installedExtensionIds, installedRecipeIds } = useMemo(
    () => ({
      installedExtensionIds: new Set<UUID>(
        installedExtensions.map((extension) => extension.id)
      ),
      installedRecipeIds: new Set(
        installedExtensions.map((extension) => extension._recipe?.id)
      ),
    }),
    [installedExtensions]
  );

  const isActive = useCallback(
    (installable: Installable) => {
      if (isExtension(installable)) {
        return installedExtensionIds.has(installable.id);
      }

      return installedRecipeIds.has(installable.metadata.id);
    },
    [installedExtensionIds, installedRecipeIds]
  );

  const isDeployment = useCallback(
    (installable: Installable) => {
      if (isExtension(installable)) {
        return Boolean(installable._deployment);
      }

      for (const installedExtension of installedExtensions) {
        if (
          installedExtension._recipe?.id === getPackageId(installable) &&
          installedExtension._deployment
        ) {
          return true;
        }
      }

      return false;
    },
    [installedExtensions]
  );

  const getSharingType = useCallback(
    (installable: Installable, scope: string): SharingSource => {
      let sharingType: SharingType = null;
      const organization = getOrganization(installable, organizations);

      if (isPersonal(installable, scope)) {
        sharingType = "Personal";
      } else if (isDeployment(installable)) {
        sharingType = "Deployment";
      } else if (organization) {
        sharingType = "Team";
      } else if (isPublic(installable)) {
        sharingType = "Public";
      }

      let label: string;
      if (
        sharingType === "Team" ||
        // There's a corner case for team deployments of public market bricks. The organization will come through as
        // nullish here.
        (sharingType === "Deployment" && organization?.name)
      ) {
        label = organization.name;
      } else {
        label = sharingType;
      }

      return {
        type: sharingType,
        label,
        organization,
      };
    },
    [isDeployment, organizations]
  );

  const getStatus = useCallback(
    (installable: Installable): InstallableStatus => {
      if (isDeployment(installable)) {
        if (isExtension(installable)) {
          return isDeploymentActive(installable) ? "Active" : "Paused";
        }

        for (const installedExtension of installedExtensions) {
          if (
            installedExtension._recipe?.id === getPackageId(installable) &&
            installedExtension._deployment
          ) {
            return isDeploymentActive(installedExtension) ? "Active" : "Paused";
          }
        }
      }

      return isActive(installable) ? "Active" : "Inactive";
    },
    [installedExtensions, isActive, isDeployment]
  );

  const installableIcon = useCallback(
    (installable: Installable) => {
      const listing: MarketplaceListing | null = listings.isLoading
        ? null
        : listings.data[getPackageId(installable)];

      return (
        <InstallableIcon
          listing={listing}
          installable={installable}
          isLoading={listings.isLoading}
          size={"2x"}
        />
      );
    },
    [listings]
  );

  const installableViewItems = useMemo(
    () =>
      installables.map((installable) => ({
        name: getLabel(installable),
        description: getDescription(installable),
        sharing: {
          packageId: getPackageId(installable),
          source: getSharingType(installable, scope),
        },
        updatedAt: getUpdatedAt(installable),
        status: getStatus(installable),
        hasUpdate: updateAvailable(
          recipes.data,
          installedExtensions,
          installable
        ),
        installedVersionNumber: getInstalledVersionNumber(
          installedExtensions,
          installable
        ),
        icon: installableIcon(installable),
        installable,
      })),
    [
      getSharingType,
      getStatus,
      installableIcon,
      installables,
      installedExtensions,
      organizations,
      recipes.data,
      scope,
    ]
  );

  return {
    installableViewItems,
    isLoading: recipes.isLoading || listings.isLoading,
  };
}

export default useInstallableViewItems;
