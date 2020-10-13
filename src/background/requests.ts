import axios, { AxiosRequestConfig, Method } from "axios";
import { liftBackground } from "@/background/protocol";
import { ConfiguredService } from "@/core";
import { pixieServiceFactory } from "@/services/locator";
import { getBaseURL } from "@/services/baseService";
import { RemoteServiceError } from "@/services/errors";
import serviceRegistry from "@/services/registry";

export interface RemoteResponse<T> {
  data: T;
  status: number;
  statusText: string;
  $$proxied?: boolean;
}

export const post = liftBackground(
  "HTTP_POST",
  async (
    url: string,
    // Types we want to pass in might not have an index signature, and we want to provide a default
    // eslint-disable-next-line @typescript-eslint/ban-types
    data: object,
    config?: { [key: string]: string | string[] }
  ) => {
    return await axios.post(url, data, config);
  }
);

export const request = liftBackground(
  "HTTP_REQUEST",
  (config: AxiosRequestConfig) => axios(config)
);

function authenticate(
  config: ConfiguredService,
  request: AxiosRequestConfig
): AxiosRequestConfig {
  const service = serviceRegistry.lookup(config.serviceId);
  return service.authenticateRequest(config.config, request);
}

async function proxyRequest<T>(
  service: ConfiguredService,
  requestConfig: AxiosRequestConfig
): Promise<RemoteResponse<T>> {
  const proxyResponse = await request(
    authenticate(await pixieServiceFactory(), {
      url: `${await getBaseURL()}/api/proxy/`,
      method: "post" as Method,
      data: {
        ...requestConfig,
        service_id: service.serviceId,
      },
    })
  );
  console.debug(`Proxy response for ${service.serviceId}:`, proxyResponse);
  if (proxyResponse.data.status_code >= 400) {
    throw new RemoteServiceError(
      proxyResponse.data.message ?? proxyResponse.data.reason,
      proxyResponse
    );
  } else {
    // The json payload from the proxy is the response from the remote server
    return {
      ...proxyResponse.data.json,
      $$proxied: true,
    };
  }
}

export async function proxyService<T>(
  serviceConfig: ConfiguredService | null,
  requestConfig: AxiosRequestConfig
): Promise<RemoteResponse<T>> {
  if (typeof serviceConfig !== "object") {
    throw new Error("expected configured service for serviceConfig");
  } else if (!serviceConfig) {
    return await request(requestConfig);
  } else if (serviceConfig.proxy) {
    return await proxyRequest<T>(serviceConfig, requestConfig);
  } else {
    return await request(authenticate(serviceConfig, requestConfig));
  }
}
