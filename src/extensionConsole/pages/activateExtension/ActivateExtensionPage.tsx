/*
 * Copyright (C) 2023 PixieBrix, Inc.
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

import { faCloudDownloadAlt } from "@fortawesome/free-solid-svg-icons";
import React from "react";
import { useParams } from "react-router";
import ErrorBoundary from "@/components/ErrorBoundary";
import Page from "@/layout/Page";
import ActivateExtensionCard from "@/extensionConsole/pages/activateExtension/ActivateExtensionCard";
import { useAuthOptions } from "@/hooks/auth";
import { useGetStandaloneModDefinitionQuery } from "@/services/api";
import { type UUID } from "@/types/stringTypes";

/**
 * Page for activating an extension that's stored in the cloud.
 */
const ActivateExtensionPage: React.FunctionComponent = () => {
  const { extensionId } = useParams<{ extensionId: UUID }>();

  const {
    data: standaloneModDefinition,
    isFetching,
    error,
  } = useGetStandaloneModDefinitionQuery(
    { extensionId },
    {
      // Force-refetch the latest data for this extension before activation
      refetchOnMountOrArgChange: true,
    },
  );

  const { data: authOptions, refetch: refreshAuthOptions } = useAuthOptions();

  return (
    <Page
      title="Activate Mod"
      icon={faCloudDownloadAlt}
      error={error}
      isPending={isFetching || authOptions == null}
    >
      <ErrorBoundary>
        {standaloneModDefinition && authOptions && (
          <ActivateExtensionCard
            extension={standaloneModDefinition}
            authOptions={authOptions}
            refreshAuthOptions={refreshAuthOptions}
          />
        )}
      </ErrorBoundary>
    </Page>
  );
};

export default ActivateExtensionPage;
