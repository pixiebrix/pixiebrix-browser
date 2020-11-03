/*
 * Copyright (C) 2020 Pixie Brix, LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import axios, { AxiosRequestConfig, AxiosResponse, Method } from "axios";
import { liftBackground } from "@/background/protocol";
import { SanitizedServiceConfiguration, ServiceConfig } from "@/core";
import { pixieServiceFactory } from "@/services/locator";
import { getBaseURL } from "@/services/baseService";
import { RemoteServiceError } from "@/services/errors";
import serviceRegistry, { PIXIEBRIX_SERVICE_ID } from "@/services/registry";
import { getExtensionToken } from "@/auth/token";
import { locator } from "@/background/locator";
import { ContextError } from "@/errors";
import { isBackgroundPage } from "webext-detect-page";
import {
  deleteCachedOAuth2,
  getCachedOAuth2,
  launchOAuth2Flow,
} from "@/background/auth";

interface ProxyResponseSuccessData {
  json: unknown;
  status_code: number;
}

interface ProxyResponseErrorData {
  json: unknown;
  status_code: number;
  message?: string;
  reason?: string;
}

type ProxyResponseData = ProxyResponseSuccessData | ProxyResponseErrorData;

// Partial view of an AxiosResponse for providing common interface for proxied requests
export interface RemoteResponse<T = unknown> {
  data: T;
  status: number;
  statusText?: string;
  $$proxied?: boolean;
}

function proxyResponseToAxiosResponse(data: ProxyResponseData) {
  if (isErrorResponse(data)) {
    return {
      data: data.json,
      status: data.status_code,
      statusText: data.reason ?? data.message,
    } as AxiosResponse;
  } else {
    return {
      data: data.json,
      status: data.status_code,
    } as AxiosResponse;
  }
}

function isErrorResponse(
  data: ProxyResponseData
): data is ProxyResponseErrorData {
  return data.status_code >= 400;
}

interface SanitizedResponse<T = unknown> {
  _sanitizedResponseBrand: null;
  data: T;
  status: number;
  statusText: string;
}

function cleanResponse<T>(response: AxiosResponse<T>): SanitizedResponse<T> {
  // Firefox won't send response objects from the background page to the content script. So strip out the
  // potentially sensitive parts of the response (the request, headers, etc.)
  return JSON.parse(
    JSON.stringify({
      data: response.data,
      status: response.status,
      statusText: response.statusText,
    })
  );
}

const backgroundRequest = liftBackground<AxiosRequestConfig, SanitizedResponse>(
  "HTTP_REQUEST",
  async (config: AxiosRequestConfig) => {
    return cleanResponse(await axios(config));
  }
);

async function authenticate(
  config: SanitizedServiceConfiguration,
  request: AxiosRequestConfig
): Promise<AxiosRequestConfig> {
  if (!isBackgroundPage()) {
    throw new Error("authenticate can only be called from the background page");
  }

  const service = serviceRegistry.lookup(config.serviceId);

  if (service.id === PIXIEBRIX_SERVICE_ID) {
    const apiKey = await getExtensionToken();
    if (!apiKey) {
      throw new Error("Extension not authenticated with PixieBrix web service");
    }
    return service.authenticateRequest(
      ({ apiKey } as unknown) as ServiceConfig,
      request
    );
  } else if (service.isOAuth2) {
    const localConfig = await locator.getLocalConfig(config.id);
    let data = await getCachedOAuth2(config.id);
    if (!data) {
      data = await launchOAuth2Flow(service, localConfig);
    }
    return service.authenticateRequest(localConfig.config, request, data);
  } else {
    const localConfig = await locator.getLocalConfig(config.id);
    return service.authenticateRequest(localConfig.config, request);
  }
}

async function proxyRequest<T>(
  service: SanitizedServiceConfiguration,
  requestConfig: AxiosRequestConfig
): Promise<RemoteResponse<T>> {
  console.debug(`Proxying request for ${service.id}`);
  let proxyResponse;
  try {
    proxyResponse = (await backgroundRequest(
      await authenticate(await pixieServiceFactory(), {
        url: `${await getBaseURL()}/api/proxy/`,
        method: "post" as Method,
        data: {
          ...requestConfig,
          service_id: service.serviceId,
        },
      })
    )) as SanitizedResponse<ProxyResponseData>;
  } catch (err) {
    throw Error("An error occurred when proxying the service request");
  }

  const { data: remoteResponse } = proxyResponse;
  console.debug(`Proxy response for ${service.serviceId}:`, proxyResponse);

  if (isErrorResponse(remoteResponse)) {
    throw new RemoteServiceError(
      remoteResponse.message ?? remoteResponse.reason,
      // FIXME: should fix the type of RemoteServiceError to support incomplete responses, e.g., because
      //  the proxy doesn't return header information from the remote service
      proxyResponseToAxiosResponse(remoteResponse) as AxiosResponse
    );
  } else {
    // The json payload from the proxy is the response from the remote server
    return {
      data: remoteResponse.json as T,
      status: remoteResponse.status_code,
      $$proxied: true,
    };
  }
}

const _proxyService = liftBackground(
  "PROXY",
  async (
    serviceConfig: SanitizedServiceConfiguration,
    requestConfig: AxiosRequestConfig
  ): Promise<RemoteResponse> => {
    if (serviceConfig.proxy) {
      return await proxyRequest(serviceConfig, requestConfig);
    } else {
      try {
        return await backgroundRequest(
          await authenticate(serviceConfig, requestConfig)
        );
      } catch (ex) {
        console.debug(
          "An error occurred when making a request from the background page",
          ex
        );
        if ([401, 403].includes(ex.response?.status)) {
          // have the user login again
          const service = serviceRegistry.lookup(serviceConfig.serviceId);
          if (service.isOAuth2) {
            await deleteCachedOAuth2(serviceConfig.id);
            return await backgroundRequest(
              await authenticate(serviceConfig, requestConfig)
            );
          }
        }
        // caught outside to add additional context to the exception
        // noinspection ExceptionCaughtLocallyJS
        throw ex;
      }
    }
  }
);

export async function proxyService<TData>(
  serviceConfig: SanitizedServiceConfiguration | null,
  requestConfig: AxiosRequestConfig
): Promise<RemoteResponse<TData>> {
  if (typeof serviceConfig !== "object") {
    throw new Error("expected configured service for serviceConfig");
  } else if (!serviceConfig) {
    try {
      return (await backgroundRequest(requestConfig)) as SanitizedResponse<
        TData
      >;
    } catch (reason) {
      throw new RemoteServiceError(reason.response.statusText, reason.response);
    }
  }

  try {
    return (await _proxyService(
      serviceConfig,
      requestConfig
    )) as RemoteResponse<TData>;
  } catch (ex) {
    throw new ContextError(ex, {
      serviceId: serviceConfig.id,
      authId: serviceConfig.id,
    });
  }
}
