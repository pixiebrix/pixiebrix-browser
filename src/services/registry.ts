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

import BaseRegistry from "@/registry/memoryRegistry";
import { fromJS } from "@/services/factory";
import {
  type IntegrationConfig,
  type IntegrationABC,
} from "@/types/integrationTypes";
import { type RegistryId } from "@/types/registryTypes";
import { readReduxStorage, type ReduxStorageKey } from "@/utils/storageUtils";

const storageKey = "persist:servicesOptions" as ReduxStorageKey;

const registry = new BaseRegistry<RegistryId, IntegrationABC>(
  ["service"],
  fromJS
);

// See the ServicesState slice
type PersistedServicesState = {
  // XXX: in practice, only one of these should be true. Need to better understand/document how redux-persist stores
  // each leave of state
  configured: string | Record<string, IntegrationConfig>;
};

export async function readRawConfigurations(): Promise<IntegrationConfig[]> {
  const base: PersistedServicesState = await readReduxStorage(storageKey);

  if (typeof base?.configured === "string") {
    // Not really sure why redux-persist stores the next level down as escaped JSON?
    return Object.values(
      JSON.parse(base.configured) as Record<string, IntegrationConfig>
    );
  }

  if (!base?.configured) {
    return [];
  }

  return Object.values(base.configured);
}

export default registry;
