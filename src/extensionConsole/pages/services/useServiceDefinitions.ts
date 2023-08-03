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

import { useSelector } from "react-redux";
import { type RootState } from "@/store/optionsStore";
import { useParams } from "react-router";
import { useMemo } from "react";
import { sortBy } from "lodash";
import registry from "@/services/registry";
import { useAsyncState } from "@/hooks/common";
import { PIXIEBRIX_INTEGRATION_ID } from "@/services/constants";
import { selectConfiguredServices } from "@/store/services/servicesSelectors";
import {
  type Integration,
  type IntegrationConfig,
} from "@/types/integrationTypes";
import { type UUID } from "@/types/stringTypes";

interface IntegrationDefinitions {
  serviceDefinitions: Integration[];
  activeConfiguration: IntegrationConfig | null;
  activeService: Integration | null;
  isPending: boolean;
  showZapier: boolean;
}

const ZAPIER_SLUG = "zapier";

function useServiceDefinitions(): IntegrationDefinitions {
  const configuredServices = useSelector<RootState, IntegrationConfig[]>(
    selectConfiguredServices
  );
  const { id: configurationId } = useParams<{ id: UUID }>();

  const showZapier = configurationId === ZAPIER_SLUG;

  const [serviceDefinitions, isPending, error] = useAsyncState(
    async () =>
      sortBy(
        // eslint-disable-next-line unicorn/no-await-expression-member
        (await registry.all()).filter((x) => x.id !== PIXIEBRIX_INTEGRATION_ID),
        (x) => x.id
      ),
    []
  );

  const activeConfiguration = useMemo(
    () =>
      configurationId && configurationId !== ZAPIER_SLUG
        ? configuredServices.find((x) => x.id === configurationId)
        : null,
    [configuredServices, configurationId]
  );

  const activeService = useMemo(
    () =>
      activeConfiguration
        ? (serviceDefinitions ?? []).find(
            (x) => x.id === activeConfiguration.serviceId
          )
        : null,
    [serviceDefinitions, activeConfiguration]
  );

  if (error) {
    throw error;
  }

  return {
    activeConfiguration,
    serviceDefinitions,
    activeService,
    isPending,
    showZapier,
  };
}

export default useServiceDefinitions;
