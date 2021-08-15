/* eslint-disable filenames/match-exported */
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

import { SanitizedAuth } from "@/types/contract";
import {
  SanitizedServiceConfiguration,
  IService,
  RawServiceConfiguration,
  ServiceConfig,
  ServiceLocator,
  SanitizedConfig,
  KeyedConfig,
} from "@/core";
import { sortBy, isEmpty } from "lodash";
import registry, {
  PIXIEBRIX_SERVICE_ID,
  readRawConfigurations,
} from "@/services/registry";
import { inputProperties } from "@/helpers";
import {
  MissingConfigurationError,
  NotConfiguredError,
} from "@/services/errors";
import { fetch } from "@/hooks/fetch";

const REF_SECRETS = [
  "https://app.pixiebrix.com/schemas/key#",
  "https://app.pixiebrix.com/schemas/key",
];

enum ServiceLevel {
  Private = 0,
  Team,
  BuiltIn,
}

/** Return config excluding any secrets/keys. */
export function excludeSecrets(
  service: IService,
  config: KeyedConfig
): SanitizedConfig {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- cast required for nominal typing
  const result: SanitizedConfig = {} as SanitizedConfig;
  for (const [key, type] of Object.entries(inputProperties(service.schema))) {
    // @ts-expect-error: ts doesn't think $ref can be on SchemaDefinition
    if (!REF_SECRETS.includes(type.$ref)) {
      // Safe because we're getting from Object.entries
      // eslint-disable-next-line security/detect-object-injection
      result[key] = config[key];
    }
  }

  return result;
}

export async function pixieServiceFactory(): Promise<SanitizedServiceConfiguration> {
  return {
    _sanitizedServiceConfigurationBrand: undefined,
    id: undefined,
    serviceId: PIXIEBRIX_SERVICE_ID,
    // Don't need to proxy requests to our own service
    proxy: false,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- cast required for nominal subtyping
    config: {} as SanitizedConfig,
  };
}

type Option = {
  id: string;
  serviceId: string;
  level: ServiceLevel;
  local: boolean;
  config: ServiceConfig | SanitizedConfig;
};

let wasInitialized = false;

class LazyLocatorFactory {
  private remote: SanitizedAuth[] = [];

  private local: RawServiceConfiguration[] = [];

  private options: Option[];

  private _initialized = false;

  private _refreshPromise: Promise<void>;

  private updateTimestamp: number = undefined;

  constructor() {
    if (wasInitialized) {
      throw new Error("LazyLocatorFactory is a singleton class");
    }

    wasInitialized = true;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  async refreshRemote(): Promise<void> {
    this.remote = await fetch<SanitizedAuth[]>("/api/services/shared/?meta=1");
    console.debug(`Fetched ${this.remote.length} remote service auths`);
    this.makeOptions();
  }

  async refreshLocal(): Promise<void> {
    this.local = await readRawConfigurations();
    this.makeOptions();
  }

  // TODO: Replace with proper debouncer when one exists https://github.com/sindresorhus/promise-fun/issues/15
  async refresh(): Promise<void> {
    this._refreshPromise = this._refreshPromise ?? this._refresh();
    await this._refreshPromise;
    this._refreshPromise = undefined;
  }

  private async _refresh(): Promise<void> {
    const timestamp = Date.now();
    await Promise.all([this.refreshLocal(), this.refreshRemote()]);
    this.makeOptions();
    this._initialized = true;
    this.updateTimestamp = timestamp;
    console.debug(`Refreshed service configuration locator`, {
      updateTimestamp: this.updateTimestamp,
    });
  }

  private makeOptions() {
    this.options = sortBy(
      [
        ...this.local.map((x) => ({
          ...x,
          level: ServiceLevel.Private,
          local: true,
        })),
        ...(this.remote ?? []).map((x) => ({
          ...x,
          level: x.organization ? ServiceLevel.Team : ServiceLevel.BuiltIn,
          local: false,
          serviceId: x.service.name,
        })),
      ],
      (x) => x.level
    );
  }

  getLocator(): ServiceLocator {
    return LazyLocatorFactory.prototype.locate.bind(this);
  }

  async getLocalConfig(authId: string): Promise<RawServiceConfiguration> {
    if (!this.initialized) {
      await this.refresh();
    }

    return this.local.find((x) => x.id === authId);
  }

  async locate(
    serviceId: string,
    authId: string
  ): Promise<SanitizedServiceConfiguration> {
    if (!this.initialized) {
      await this.refresh();
    }

    if (serviceId === PIXIEBRIX_SERVICE_ID) {
      // HACK: for now use the separate storage for the extension key
      return pixieServiceFactory();
    }

    if (!authId) {
      throw new NotConfiguredError(
        `No configuration selected for ${serviceId}`,
        serviceId
      );
    }

    const service = await registry.lookup(serviceId);

    const match = this.options.find(
      (x) => x.serviceId === serviceId && x.id === authId
    );

    if (!match) {
      throw new MissingConfigurationError(
        `Configuration ${authId} not found for ${serviceId}`,
        serviceId,
        authId
      );
    }

    if (isEmpty(match.config)) {
      console.warn(`Config ${authId} for service ${serviceId} is empty`);
    }

    console.debug(`Locate auth for ${serviceId}`, {
      currentTimestamp: Date.now(),
      updateTimestamp: this.updateTimestamp,
      id: authId,
      config: match.config,
      proxy: service.hasAuth && !match.local,
    });

    return {
      _sanitizedServiceConfigurationBrand: undefined,
      id: authId,
      serviceId,
      proxy: service.hasAuth && !match.local,
      config: excludeSecrets(service, match.config),
    };
  }
}

export default LazyLocatorFactory;
