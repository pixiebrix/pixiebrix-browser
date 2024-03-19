/*
 * Copyright (C) 2024 PixieBrix, Inc.
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

import { type RemoteIntegrationConfig } from "@/types/contract";
import { isEmpty, sortBy } from "lodash";
import servicesRegistry, {
  readRawConfigurations,
} from "@/integrations/registry";
import { validateRegistryId } from "@/types/helpers";
import { expectContext, forbidContext } from "@/utils/expectContext";
import { ExtensionNotLinkedError } from "@/errors/genericErrors";
import {
  MissingConfigurationError,
  NotConfiguredError,
} from "@/errors/businessErrors";
import {
  type IntegrationABC,
  type IntegrationConfig,
  type SanitizedConfig,
  type SanitizedIntegrationConfig,
  type SecretsConfig,
} from "@/integrations/integrationTypes";
import { type UUID } from "@/types/stringTypes";
import { DoesNotExistError, type RegistryId } from "@/types/registryTypes";
import { sanitizeIntegrationConfig } from "@/integrations/sanitizeIntegrationConfig";
import { PIXIEBRIX_INTEGRATION_ID } from "@/integrations/constants";
import { getLinkedApiClient } from "@/data/service/apiClient";
import { memoizeUntilSettled } from "@/utils/promiseUtils";
import { type SetRequired } from "type-fest";

enum Visibility {
  Private = 0,
  Team,
  BuiltIn,
}

export async function pixiebrixConfigurationFactory(): Promise<SanitizedIntegrationConfig> {
  return {
    id: undefined,
    serviceId: PIXIEBRIX_INTEGRATION_ID,
    // Don't need to proxy requests to our own service
    proxy: false,
    config: {} as SanitizedConfig,
  } as SanitizedIntegrationConfig;
}

type Option = {
  /**
   * The configuration id.
   */
  id: UUID;

  /**
   * Human-readable label for the configuration to distinguish it from other configurations for the same integration
   * in the interface.
   */
  label: string | undefined;

  /**
   * The registry id of the integration definition package.
   */
  serviceId: RegistryId;
  /**
   * Visibility/provenance of the integration configuration.
   */
  level: Visibility;
  /**
   * The provenance of the configuration option. True if the integration was configured in the Extension Console.
   */
  local: boolean;
  /**
   * True if the integration configuration uses the API Gateway.
   * @since 1.7.34
   */
  proxy: boolean;
  /**
   * The configuration, including secrets for locally-defined and pushdown integration configurations.
   */
  config: SecretsConfig | SanitizedConfig;
};

let wasInitialized = false;

/**
 * Singleton class that produces `ServiceLocator` methods via `getLocator`.
 *
 * NOTE: this class handles service credentials, not the service definitions. For service definitions, see the
 * `services.registry` file.
 */
class LazyLocatorFactory {
  private remote: RemoteIntegrationConfig[] = [];

  private local: IntegrationConfig[] = [];

  private options: Option[] = [];

  private updateTimestamp: number | undefined;

  constructor() {
    forbidContext(
      "contentScript",
      "LazyLocatorFactory cannot run in the contentScript",
    );

    if (wasInitialized) {
      throw new Error("LazyLocatorFactory is a singleton class");
    }

    wasInitialized = true;
  }

  get initialized(): boolean {
    return Boolean(this.updateTimestamp);
  }

  async refreshRemote(): Promise<void> {
    try {
      // As of https://github.com/pixiebrix/pixiebrix-app/issues/562, the API gracefully handles unauthenticated calls
      // to this endpoint. However, there's no need to pull the built-in services because the user can't call them
      // without being authenticated
      const client = await getLinkedApiClient();
      const { data } = await client.get<RemoteIntegrationConfig[]>(
        // Fetch full configurations, including credentials for configurations with pushdown
        "/api/services/shared/",
      );
      this.remote = data;
      console.debug(`Fetched ${this.remote.length} remote service auth(s)`);
    } catch (error) {
      if (error instanceof ExtensionNotLinkedError) {
        this.remote = [];
      } else {
        throw error;
      }
    }

    this.initializeOptions();
  }

  async refreshLocal(): Promise<void> {
    this.local = await readRawConfigurations();
    this.initializeOptions();
  }

  /**
   * Refreshes the local and remote integration configurations.
   */
  // eslint-disable-next-line unicorn/consistent-function-scoping -- Clearer here
  refresh = memoizeUntilSettled(async () => {
    const timestamp = Date.now();
    await Promise.all([this.refreshLocal(), this.refreshRemote()]);
    this.initializeOptions();
    this.updateTimestamp = timestamp;
    console.debug("Refreshed service configuration locator", {
      updateTimestamp: this.updateTimestamp,
    });
  });

  private initializeOptions() {
    this.options = sortBy(
      [
        ...this.local.map(
          (x) =>
            ({
              ...x,
              level: Visibility.Private,
              local: true,
              proxy: false,
              serviceId: x.integrationId,
              // TODO: Unsafe. Remove once the `id` in `IntegrationConfig` is not optional
            }) as SetRequired<Option, "id">,
        ),
        ...(this.remote ?? []).map((x) => ({
          ...x,
          // Server JSON response uses null instead of undefined for `label`
          label: x.label ?? undefined,
          level: x.organization ? Visibility.Team : Visibility.BuiltIn,
          local: false,
          proxy: !x.pushdown,
          serviceId: validateRegistryId(x.service.name),
        })),
      ],
      (x) => x.level,
    );
  }

  /**
   * Return the corresponding integration configuration, including secrets. Returns `null` if not available.
   *
   * Prior to 1.7.34, only could return locally-defined configurations. Now also returns remote pushdown configurations.
   *
   * @param configId UUID of the integration configuration
   */
  async findIntegrationConfig(
    configId: UUID,
  ): Promise<IntegrationConfig | undefined> {
    if (!this.initialized) {
      await this.refresh();
    }

    const remote = this.remote
      .filter((x) => x.pushdown)
      .map(
        (x) =>
          ({
            id: x.id,
            integrationId: x.service.name,
            label: x.label,
            config: x.config,
            // `config` will contain secrets because we filtered for pushdown configurations
          }) as IntegrationConfig,
      );

    return [...this.local, ...remote].find((x) => x.id === configId);
  }

  async locateAllForService(
    serviceId: RegistryId,
  ): Promise<SanitizedIntegrationConfig[]> {
    if (!this.initialized) {
      await this.refresh();
    }

    if (serviceId === PIXIEBRIX_INTEGRATION_ID) {
      // HACK: for now use the separate storage for the extension key
      return [await pixiebrixConfigurationFactory()];
    }

    let service: IntegrationABC;

    // Handle case where locateAllForService is called before service definitions are loaded. (For example, because it's
    // being called from the background page in installer.ts).
    // In the future, we may want to expose an option on the method to control this behavior.
    try {
      service = await servicesRegistry.lookup(serviceId);
    } catch (error) {
      if (error instanceof DoesNotExistError) {
        return [];
      }

      throw error;
    }

    return this.options
      .filter((x) => x.serviceId === serviceId)
      .map((match) => ({
        _sanitizedIntegrationConfigBrand: null,
        id: match.id,
        label: match.label,
        serviceId,
        proxy: match.proxy,
        config: sanitizeIntegrationConfig(service, match.config),
      }));
  }

  async locate(
    serviceId: RegistryId,
    authId: UUID,
  ): Promise<SanitizedIntegrationConfig> {
    expectContext(
      "background",
      "The service locator must run in the background worker",
    );

    if (!this.initialized) {
      await this.refresh();
    }

    if (serviceId === PIXIEBRIX_INTEGRATION_ID) {
      // HACK: for now use the separate storage for the extension key
      return pixiebrixConfigurationFactory();
    }

    if (!authId) {
      throw new NotConfiguredError(
        `No configuration selected for ${serviceId}`,
        serviceId,
      );
    }

    const service = await servicesRegistry.lookup(serviceId);

    const match = this.options.find(
      (x) => x.serviceId === serviceId && x.id === authId,
    );

    if (!match) {
      throw new MissingConfigurationError(
        `Configuration ${authId} not found for ${serviceId}`,
        serviceId,
        authId,
      );
    }

    // Proxied configurations have their secrets removed, so can be empty on the client-side.
    // Some OAuth2 PKCE services, e.g. google/oauth2-pkce, don't require any configurations, so can be empty.
    if (
      isEmpty(match.config) &&
      !isEmpty(service.schema.properties) &&
      !match.proxy &&
      service.hasAuth
    ) {
      console.warn(`Config ${authId} for service ${serviceId} is empty`);
    }

    console.debug(`Locate auth for ${serviceId}`, {
      currentTimestamp: Date.now(),
      updateTimestamp: this.updateTimestamp,
      id: authId,
      proxy: match.proxy,
    });

    return {
      _sanitizedIntegrationConfigBrand: null,
      id: authId,
      label: match.label,
      serviceId,
      proxy: match.proxy,
      config: sanitizeIntegrationConfig(service, match.config),
    };
  }
}

export default LazyLocatorFactory;
