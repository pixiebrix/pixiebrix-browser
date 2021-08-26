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

import { readStorageWithMigration } from "@/chrome";
import BaseRegistry from "@/baseRegistry";
import { fromJS } from "@/services/factory";
import { RawServiceConfiguration, RegistryId } from "@/core";
import { Service } from "@/types";

const storageKey = "persist:servicesOptions";

const registry = new BaseRegistry<RegistryId, Service>(
  ["service"],
  "services",
  fromJS
);

export async function readRawConfigurations(): Promise<
  RawServiceConfiguration[]
> {
  const base = await readStorageWithMigration(storageKey);
  if (!base?.configured) {
    return [];
  }

  if (typeof base.configured === "string") {
    // Not really sure why the next level down is escaped JSON?
    return Object.values(JSON.parse(base.configured));
  }

  return Object.values(base.configured);
}

export default registry;
