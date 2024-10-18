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

import axios, { type AxiosResponse, type Method } from "axios";
import type { NetworkRequestConfig } from "@/types/networkTypes";
import integrationRegistry from "@/integrations/registry";
import { getExtensionToken } from "@/auth/authStorage";
import { integrationConfigLocator } from "@/background/integrationConfigLocator";
import { isEmpty } from "lodash";
import launchOAuth2Flow from "@/background/auth/launchOAuth2Flow";
import { expectContext } from "@/utils/expectContext";
import { absoluteApiUrl } from "@/data/service/apiClient";
import { type ProxyResponseData, type RemoteResponse } from "@/types/contract";
import {
  isProxiedErrorResponse,
  proxyResponseToAxiosResponse,
  selectRemoteResponseErrorMessage,
} from "@/background/proxyUtils";
import { selectAxiosError } from "@/data/service/requestErrorUtils";
import {
  BusinessError,
  ProxiedRemoteServiceError,
} from "@/errors/businessErrors";
import { ContextError, ExtensionNotLinkedError } from "@/errors/genericErrors";
import {
  isAxiosError,
  safeGuessStatusText,
} from "@/errors/networkErrorHelpers";
import { deserializeError, serializeError } from "serialize-error";
import {
  type AuthData,
  type Integration,
  type IntegrationConfig,
  type SanitizedIntegrationConfig,
  type SecretsConfig,
} from "@/integrations/integrationTypes";
import { type MessageContext } from "@/types/loggerTypes";
import refreshPKCEToken from "@/background/refreshToken";
import reportError from "@/telemetry/reportError";
import { assertProtocolUrl, isUrlRelative } from "@/utils/urlUtils";
import { ensureJsonObject } from "@/utils/objectUtils";
import {
  deleteCachedAuthData,
  getCachedAuthData,
} from "@/background/auth/authStorage";
import { getToken } from "@/background/auth/getToken";
import {
  CONTROL_ROOM_OAUTH_INTEGRATION_ID,
  PIXIEBRIX_INTEGRATION_ID,
} from "@/integrations/constants";
import { memoizeUntilSettled } from "@/utils/promiseUtils";
import { pixiebrixConfigurationFactory } from "@/integrations/util/pixiebrixConfigurationFactory";
import { type Nullishable } from "@/utils/nullishUtils";

import { isAuthenticationAxiosError } from "@/auth/isAuthenticationAxiosError";
import { API_PATHS } from "@/data/service/urlPaths";

// Firefox won't send response objects from the background page to the content script. Strip out the
// potentially sensitive parts of the response (the request, headers, etc.)
type SanitizedResponse<T = unknown> = Pick<
  AxiosResponse<T>,
  "data" | "status" | "statusText"
> & {
  _sanitizedResponseBrand: null;
};

function sanitizeResponse<T>(response: AxiosResponse<T>): SanitizedResponse<T> {
  const { data, status, statusText } = response;
  return ensureJsonObject({ data, status, statusText }) as SanitizedResponse<T>;
}

/**
 * Prepare the error with an AxiosError in the cause chain for being sent across messenger boundaries.
 * @see SanitizedResponse
 */
function prepareErrorForMessenger(error: unknown): unknown {
  if (error == null) {
    return null;
  }

  if (isAxiosError((error as Error)?.cause)) {
    const parentError = error as Error;
    // See https://github.com/pixiebrix/pixiebrix-extension/pull/3645
    // Chrome 102 + serializeError 11.0.0 was really struggling with automatically serializing correctly. The response
    // and request properties were getting dropped. (Potentially because AxiosError is sometimes missing a stack, or
    // it may depend on which properties are enumerable)
    parentError.cause = deserializeError(
      serializeError(parentError.cause, { useToJSON: false }),
    );
  }

  prepareErrorForMessenger((error as Error)?.cause);

  return error;
}

async function serializableAxiosRequest<T>(
  config: NetworkRequestConfig,
): Promise<SanitizedResponse<T>> {
  // Network requests must go through background page for permissions/CORS to work properly
  expectContext(
    "background",
    "Network requests must be made from the background page",
  );

  // Axios does not perform validation, so call before axios
  assertProtocolUrl(config.url, ["https:", "http:"]);

  return sanitizeResponse(await axios(config));
}

/**
 * Get cached auth data for OAuth2, or login if no data found. Memoize so that multiple logins
 * are not kicked off at once.
 */
export const getOAuth2AuthData = memoizeUntilSettled(
  async (
    integration: Integration,
    localConfig: IntegrationConfig,
    sanitizedIntegrationConfig: SanitizedIntegrationConfig,
    options: { interactive: boolean },
  ): Promise<AuthData> => {
    // We wrap both the cache data lookup and the login request in the memoization here
    // instead of only around the login call, in order to avoid a race condition between
    // writing the new auth token and a second request reading from cached auth storage.
    let data = await getCachedAuthData(sanitizedIntegrationConfig.id);
    if (isEmpty(data)) {
      data = await launchOAuth2Flow(integration, localConfig, options);
    }

    return data;
  },
);

async function authenticate(
  config: SanitizedIntegrationConfig,
  request: NetworkRequestConfig,
  options: { interactive: boolean },
): Promise<NetworkRequestConfig> {
  expectContext("background");

  if (config.proxy) {
    throw new Error(
      `Integration configuration for service ${config.serviceId} is not a local configuration: ${config.id}`,
    );
  }

  const integration = await integrationRegistry.lookup(config.serviceId);

  // The PixieBrix API doesn't use integration configurations
  if (integration.id === PIXIEBRIX_INTEGRATION_ID) {
    const apiKey = await getExtensionToken();
    if (!apiKey) {
      throw new ExtensionNotLinkedError();
    }

    return integration.authenticateRequest(
      { apiKey } as unknown as SecretsConfig,
      {
        ...request,
        url: await absoluteApiUrl(request.url),
      },
    );
  }

  const localConfig = await integrationConfigLocator.findIntegrationConfig(
    config.id,
  );

  if (!localConfig) {
    // Is an application error because PixieBrix should not have reached here in the first place.
    throw new Error(`Local integration configuration not found: ${config.id}`);
  }

  if (integration.isOAuth2) {
    const data = await getOAuth2AuthData(
      integration,
      localConfig,
      config,
      options,
    );
    return integration.authenticateRequest(localConfig.config, request, data);
  }

  if (integration.isToken) {
    let data = await getCachedAuthData(config.id);
    if (isEmpty(data)) {
      console.debug(`Fetching token for ${config.id}`);
      data = await getToken(integration, localConfig);
    }

    if (isEmpty(data)) {
      throw new Error(
        `No auth data found for token authentication response for ${integration.id}`,
      );
    }

    return integration.authenticateRequest(localConfig.config, request, data);
  }

  return integration.authenticateRequest(localConfig.config, request);
}

async function proxyRequest<T>(
  integrationConfig: SanitizedIntegrationConfig,
  requestConfig: NetworkRequestConfig,
): Promise<RemoteResponse<T>> {
  const authenticatedRequestConfig = await authenticate(
    pixiebrixConfigurationFactory(),
    {
      url: await absoluteApiUrl(API_PATHS.PROXY),
      method: "post" as Method,
      data: {
        ...requestConfig,
        auth_id: integrationConfig.id,
        service_id: integrationConfig.serviceId,
      },
    },
    // The PixieBrix API uses a token, so does not require/support interactive authentication
    { interactive: false },
  );

  const proxyResponse = await serializableAxiosRequest<ProxyResponseData>(
    authenticatedRequestConfig,
  );

  const { data: remoteResponse } = proxyResponse;

  if (isProxiedErrorResponse(remoteResponse)) {
    throw new ProxiedRemoteServiceError(
      selectRemoteResponseErrorMessage(remoteResponse),
      proxyResponseToAxiosResponse(remoteResponse),
    );
  }

  // The json payload from the proxy is the response from the remote server
  return {
    data: remoteResponse.json as T,
    status: remoteResponse.status_code,
    statusText: safeGuessStatusText(remoteResponse.status_code),
    $$proxied: true,
  };
}

async function _performConfiguredRequest(
  integrationConfig: SanitizedIntegrationConfig,
  requestConfig: NetworkRequestConfig,
  options: { interactiveLogin: boolean },
): Promise<RemoteResponse> {
  if (integrationConfig.proxy) {
    // Service uses the PixieBrix remote proxy to perform authentication. Proxy the request.
    return proxyRequest(integrationConfig, requestConfig);
  }

  try {
    return await serializableAxiosRequest(
      await authenticate(integrationConfig, requestConfig, {
        interactive: options.interactiveLogin,
      }),
    );
  } catch (error) {
    // Try again - automatically try to get a new token using the refresh token (if applicable)
    // or have the user login again

    const axiosError = selectAxiosError(error);

    if (axiosError && isAuthenticationAxiosError(axiosError)) {
      const integration = await integrationRegistry.lookup(
        integrationConfig.serviceId,
      );
      if (integration.isOAuth2 || integration.isToken) {
        // Don't refresh the Automation Anywhere OAuth2 token here because it has its own unique refresh call
        // that is called on a schedule (see initPartnerTokenRefresh).
        if (
          integration.isOAuth2PKCE &&
          integration.id !== CONTROL_ROOM_OAUTH_INTEGRATION_ID
        ) {
          try {
            const isTokenRefreshed = await refreshPKCEToken(
              integration,
              integrationConfig,
            );

            if (isTokenRefreshed) {
              return await serializableAxiosRequest(
                await authenticate(integrationConfig, requestConfig, {
                  interactive: options.interactiveLogin,
                }),
              );
            }
          } catch (error) {
            console.warn(`Failed to refresh ${integration.id} token:`, error);

            // An authentication error can occur if the refresh token was revoked. Besides that, there should be
            // no reason for the refresh to fail. Report the error if it's not an authentication error.
            const axiosError = selectAxiosError(error);
            if (!axiosError || !isAuthenticationAxiosError(axiosError)) {
              reportError(error);
            }
          }
        }

        // Delete all cached auth data, which will require the user to login again.
        await deleteCachedAuthData(integrationConfig.id);

        return serializableAxiosRequest(
          await authenticate(integrationConfig, requestConfig, {
            interactive: options.interactiveLogin,
          }),
        );
      }
    }

    console.debug("Error making request from the background page", {
      error,
      integrationConfig,
      request: requestConfig,
    });

    throw (
      (error as Error) ??
      new Error("Unknown error making request from the background page")
    );
  }
}

async function getIntegrationMessageContext(
  config: SanitizedIntegrationConfig,
): Promise<MessageContext> {
  // Try resolving the integration to get metadata to include with the error
  let resolvedIntegration: Integration | undefined;
  try {
    resolvedIntegration = await integrationRegistry.lookup(config.serviceId);
  } catch {
    // NOP
  }

  return {
    integrationId: config.serviceId,
    integrationVersion: resolvedIntegration?.version,
    authId: config.id,
  };
}

/**
 * Perform a request either directly, or via the PixieBrix authentication proxy
 * @param integrationConfig the PixieBrix integration configuration (used to locate the full configuration)
 * @param requestConfig the unauthenticated axios request configuration
 * @param options options, e.g., whether to prompt the user for login if necessary
 */
export async function performConfiguredRequest<TData>(
  // Note: This signature is ignored by `webext-messenger` due to the generic,
  // so it must be copied into `background/messenger/api.ts`
  integrationConfig: Nullishable<SanitizedIntegrationConfig>,
  requestConfig: NetworkRequestConfig,
  options: { interactiveLogin: boolean },
): Promise<RemoteResponse<TData>> {
  if (integrationConfig != null && typeof integrationConfig !== "object") {
    throw new TypeError(
      "expected configured integration for integrationConfig",
    );
  }

  if (!integrationConfig) {
    // No integration configuration provided. Perform request directly without authentication
    if (isUrlRelative(requestConfig.url)) {
      throw new BusinessError(
        "expected absolute URL for request without integration",
      );
    }

    try {
      return await serializableAxiosRequest<TData>(requestConfig);
    } catch (error) {
      const preparedError = prepareErrorForMessenger(error);
      console.debug("Error making request without integration config", {
        requestConfig,
        preparedError,
        error,
      });
      throw preparedError;
    }
  }

  try {
    return (await _performConfiguredRequest(
      integrationConfig,
      requestConfig,
      options,
    )) as RemoteResponse<TData>;
  } catch (error) {
    throw new ContextError("Error performing request", {
      cause: prepareErrorForMessenger(error),
      context: await getIntegrationMessageContext(integrationConfig),
    });
  }
}
