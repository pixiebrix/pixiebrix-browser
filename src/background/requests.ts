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

import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type Method,
} from "axios";
import {
  type IService,
  type MessageContext,
  type SanitizedServiceConfiguration,
  type ServiceConfig,
} from "@/core";
import { pixieServiceFactory } from "@/services/locator";
import serviceRegistry from "@/services/registry";
import { getExtensionToken } from "@/auth/token";
import { locator } from "@/background/locator";
import { isEmpty } from "lodash";
import {
  deleteCachedAuthData,
  getCachedAuthData,
  getToken,
  launchOAuth2Flow,
} from "@/background/auth";
import { isAbsoluteUrl, isObject } from "@/utils";
import { expectContext } from "@/utils/expectContext";
import { absoluteApiUrl } from "@/services/apiClient";
import { PIXIEBRIX_SERVICE_ID } from "@/services/constants";
import { type ProxyResponseData, type RemoteResponse } from "@/types/contract";
import {
  isProxiedErrorResponse,
  proxyResponseToAxiosResponse,
} from "@/background/proxyUtils";
import { selectAxiosError } from "@/services/requestErrorUtils";
import {
  BusinessError,
  ProxiedRemoteServiceError,
} from "@/errors/businessErrors";
import { ContextError, ExtensionNotLinkedError } from "@/errors/genericErrors";
import { assertHttpsUrl } from "@/errors/assertHttpsUrl";
import {
  isAxiosError,
  safeGuessStatusText,
} from "@/errors/networkErrorHelpers";
import safeJsonStringify from "json-stringify-safe";
import { deserializeError, serializeError } from "serialize-error";

// Firefox won't send response objects from the background page to the content script. Strip out the
// potentially sensitive parts of the response (the request, headers, etc.)
type SanitizedResponse<T = unknown> = Pick<
  AxiosResponse<T>,
  "data" | "status" | "statusText"
> & {
  _sanitizedResponseBrand: null;
};

function sanitizeResponse<T>(
  response: AxiosResponse<T> | null
): SanitizedResponse<T> | null {
  if (response == null) {
    return null;
  }

  const { data, status, statusText } = response;
  return JSON.parse(safeJsonStringify({ data, status, statusText }));
}

/**
 * Prepare the error with an AxiosError in the cause chain for being sent across messenger boundaries.
 * @SanitizedResponse
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
      serializeError(parentError.cause, { useToJSON: false })
    );
  }

  prepareErrorForMessenger((error as Error)?.cause);

  return error;
}

export async function serializableAxiosRequest<T>(
  config: AxiosRequestConfig
): Promise<SanitizedResponse<T>> {
  // Network requests must go through background page for permissions/CORS to work properly
  expectContext(
    "background",
    "Network requests must be made from the background page"
  );

  // Axios does not perform validation, so call before the axios call.
  assertHttpsUrl(config.url, config.baseURL);

  const response = await axios(config);

  return sanitizeResponse(response);
}

async function authenticate(
  config: SanitizedServiceConfiguration,
  request: AxiosRequestConfig
): Promise<AxiosRequestConfig> {
  expectContext("background");

  if (config == null) {
    throw new Error("Integration configuration is required to authenticate");
  }

  if (config.proxy) {
    throw new Error(
      `Integration configuration for service ${config.serviceId} is not a local configuration: ${config.id}`
    );
  }

  const service = await serviceRegistry.lookup(config.serviceId);

  // The PixieBrix API doesn't use integration configurations
  if (service.id === PIXIEBRIX_SERVICE_ID) {
    const apiKey = await getExtensionToken();
    if (!apiKey) {
      throw new ExtensionNotLinkedError();
    }

    return service.authenticateRequest({ apiKey } as unknown as ServiceConfig, {
      ...request,
      url: await absoluteApiUrl(request.url),
    });
  }

  const localConfig = await locator.getLocalConfig(config.id);

  if (!localConfig) {
    // Is an application error because PixieBrix should not have reached here in the first place.
    throw new Error(`Local integration configuration not found: ${config.id}`);
  }

  if (service.isOAuth2) {
    let data = await getCachedAuthData(config.id);
    if (isEmpty(data)) {
      data = await launchOAuth2Flow(service, localConfig);
    }

    return service.authenticateRequest(localConfig.config, request, data);
  }

  if (service.isToken) {
    let data = await getCachedAuthData(config.id);
    if (isEmpty(data)) {
      console.debug(`Fetching token for ${config.id}`);
      data = await getToken(service, localConfig);
    }

    if (isEmpty(data)) {
      throw new Error(
        `No auth data found for token authentication response for ${service.id}`
      );
    }

    return service.authenticateRequest(localConfig.config, request, data);
  }

  return service.authenticateRequest(localConfig.config, request);
}

async function proxyRequest<T>(
  service: SanitizedServiceConfiguration,
  requestConfig: AxiosRequestConfig
): Promise<RemoteResponse<T>> {
  if (service == null) {
    throw new Error("service is required for proxyRequest");
  }

  const authenticatedRequestConfig = await authenticate(
    await pixieServiceFactory(),
    {
      url: await absoluteApiUrl("/api/proxy/"),
      method: "post" as Method,
      data: {
        ...requestConfig,
        auth_id: service.id,
        service_id: service.serviceId,
      },
    }
  );

  const proxyResponse = await serializableAxiosRequest<ProxyResponseData>(
    authenticatedRequestConfig
  );

  const { data: remoteResponse } = proxyResponse;

  if (isProxiedErrorResponse(remoteResponse)) {
    throw new ProxiedRemoteServiceError(
      remoteResponse.message ?? remoteResponse.reason,
      proxyResponseToAxiosResponse(remoteResponse)
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

const UNAUTHORIZED_STATUS_CODES = new Set([401, 403]);

export function isAuthenticationError(
  error: Pick<AxiosError, "response">
): boolean {
  // Response should be an object, but be defensive
  if (error.response == null || !isObject(error.response)) {
    return false;
  }

  // Technically 403 is an authorization error and re-authenticating as the same user won't help. However, there is
  // a case where the user just needs an updated JWT that contains the most up-to-date entitlements
  if (UNAUTHORIZED_STATUS_CODES.has(error.response.status)) {
    return true;
  }

  // Handle Automation Anywhere's Control Room expired JWT response. They'll return this from any endpoint instead
  // of a proper error code.
  if (
    error.response.status === 400 &&
    isObject(error.response.data) &&
    error.response.data.message === "Access Token has expired"
  ) {
    return true;
  }
}

async function performConfiguredRequest(
  serviceConfig: SanitizedServiceConfiguration,
  requestConfig: AxiosRequestConfig
): Promise<RemoteResponse> {
  if (serviceConfig.proxy) {
    // Service uses the PixieBrix remote proxy to perform authentication. Proxy the request.
    return proxyRequest(serviceConfig, requestConfig);
  }

  try {
    return await serializableAxiosRequest(
      await authenticate(serviceConfig, requestConfig)
    );
  } catch (error) {
    // Try again - have the user login again, or automatically try to get a new token

    const axiosError = selectAxiosError(error);

    if (axiosError && isAuthenticationError(axiosError)) {
      const service = await serviceRegistry.lookup(serviceConfig.serviceId);
      if (service.isOAuth2 || service.isToken) {
        await deleteCachedAuthData(serviceConfig.id);
        return serializableAxiosRequest(
          await authenticate(serviceConfig, requestConfig)
        );
      }
    }

    console.debug("Error making request from the background page", {
      error,
      serviceConfig,
      request: requestConfig,
    });

    throw (
      error ??
      new Error("Unknown error making request from the background page")
    );
  }
}

async function getServiceMessageContext(
  config: SanitizedServiceConfiguration
): Promise<MessageContext> {
  // Try resolving the service to get metadata to include with the error
  let resolvedService: IService;
  try {
    resolvedService = await serviceRegistry.lookup(config.serviceId);
  } catch {
    // NOP
  }

  return {
    serviceId: config.serviceId,
    serviceVersion: resolvedService?.version,
    authId: config.id,
  };
}

/**
 * Perform a request either directly, or via the PixieBrix authentication proxy
 * @param serviceConfig the PixieBrix service configuration (used to locate the full configuration)
 * @param requestConfig the unauthenticated axios request configuration
 */
export async function proxyService<TData>(
  serviceConfig: SanitizedServiceConfiguration | null,
  requestConfig: AxiosRequestConfig
  // Note: This signature is ignored by `webext-messenger`
  // so it must be copied into `background/messenger/api.ts`
): Promise<RemoteResponse<TData>> {
  if (serviceConfig != null && typeof serviceConfig !== "object") {
    throw new TypeError("expected configured service for serviceConfig");
  }

  if (!serviceConfig) {
    // No service configuration provided. Perform request directly without authentication
    if (!isAbsoluteUrl(requestConfig.url) && requestConfig.baseURL == null) {
      throw new BusinessError(
        "expected absolute URL for request without service"
      );
    }

    try {
      return await serializableAxiosRequest<TData>(requestConfig);
    } catch (error) {
      const preparedError = prepareErrorForMessenger(error);
      console.debug("Error making request without service config", {
        requestConfig,
        preparedError,
        error,
      });
      throw preparedError;
    }
  }

  try {
    return (await performConfiguredRequest(
      serviceConfig,
      requestConfig
    )) as RemoteResponse<TData>;
  } catch (error) {
    throw new ContextError("Error performing request", {
      cause: prepareErrorForMessenger(error),
      context: await getServiceMessageContext(serviceConfig),
    });
  }
}
