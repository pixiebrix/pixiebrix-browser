/*
 * Copyright (C) 2022 PixieBrix, Inc.
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

import {
  RawServiceConfiguration,
  SanitizedServiceConfiguration,
  ServiceConfig,
} from "@/core";
import serviceRegistry from "@/services/registry";
import axios, { AxiosError, AxiosRequestConfig } from "axios";
import MockAdapter from "axios-mock-adapter";
import { isBackground, isExtensionContext } from "webext-detect-page";
import { PIXIEBRIX_SERVICE_ID } from "@/services/constants";
import { proxyService } from "./requests";
import { ContextError } from "@/errors";
import * as token from "@/auth/token";
import * as locator from "@/services/locator";
import { RemoteServiceError } from "@/services/errors";
import { validateRegistryId } from "@/types/helpers";

const axiosMock = new MockAdapter(axios);
const mockIsBackground = isBackground as jest.MockedFunction<
  typeof isBackground
>;
const mockIsExtensionContext = isExtensionContext as jest.MockedFunction<
  typeof isExtensionContext
>;
mockIsBackground.mockImplementation(() => true);
mockIsExtensionContext.mockImplementation(() => true);

jest.mock("@/background/protocol");
jest.mock("@/auth/token");
jest.mock("webext-detect-page");
jest.mock("@/services/locator");

const Locator = locator.default;

afterEach(() => {
  axiosMock.reset();
  axiosMock.resetHistory();
  (Locator as jest.Mock).mockClear();
});

(token.getExtensionToken as jest.Mock).mockResolvedValue("abc123");

// Use real version of pixieServiceFactory
const { pixieServiceFactory } = jest.requireActual("@/services/locator");
(locator.pixieServiceFactory as jest.Mock) = pixieServiceFactory;

const EXAMPLE_SERVICE_API = validateRegistryId("example/api");

serviceRegistry.register({
  id: PIXIEBRIX_SERVICE_ID,
  authenticateRequest: (
    serviceConfig: ServiceConfig,
    requestConfig: AxiosRequestConfig
  ) => requestConfig,
} as any);

serviceRegistry.register({
  id: EXAMPLE_SERVICE_API,
  authenticateRequest: (
    serviceConfig: ServiceConfig,
    requestConfig: AxiosRequestConfig
  ) => requestConfig,
} as any);

const requestConfig: AxiosRequestConfig = {
  url: "https://www.example.com",
  method: "get",
};

const directServiceConfig = {
  id: "124",
  proxy: false,
  serviceId: EXAMPLE_SERVICE_API,
  config: {},
} as SanitizedServiceConfiguration;

const proxiedServiceConfig = {
  id: "123",
  proxy: true,
  serviceId: EXAMPLE_SERVICE_API,
  config: {},
} as SanitizedServiceConfiguration;

describe("unauthenticated direct requests", () => {
  it("makes an unauthenticated request", async () => {
    axiosMock.onAny().reply(200, {});
    const { status } = await proxyService(null, requestConfig);
    expect(status).toEqual(200);
  });

  it("requires absolute URL for unauthenticated requests", async () => {
    await expect(async () => {
      await proxyService(null, {
        url: "api/foo/",
      });
    }).rejects.toThrow(/expected absolute URL for request without service/);
  });

  it("handles remote internal server error", async () => {
    axiosMock.onAny().reply(500);

    try {
      await proxyService(null, requestConfig);
      fail("Expected proxyService to throw a RemoteServiceError error");
    } catch (error) {
      expect(error).toBeInstanceOf(RemoteServiceError);
      const { status } = (error as RemoteServiceError).error.response;
      expect(status).toEqual(500);
    }
  });
});

describe("authenticated direct requests", () => {
  beforeEach(() => {
    jest
      .spyOn(Locator.prototype, "locate")
      .mockResolvedValue(directServiceConfig);
    jest
      .spyOn(Locator.prototype, "getLocalConfig")
      .mockResolvedValue(
        directServiceConfig as unknown as RawServiceConfiguration
      );
  });

  it("makes an authenticated request", async () => {
    axiosMock.onAny().reply(200, {});
    const response = await proxyService(directServiceConfig, requestConfig);
    expect(response.status).toEqual(200);
  });

  it("throws error on bad request", async () => {
    axiosMock.onAny().reply(403, {});

    try {
      await proxyService(directServiceConfig, requestConfig);
      fail("Expected proxyService to throw an error");
    } catch (error) {
      expect(error).toBeInstanceOf(ContextError);

      const { cause } = error as ContextError;

      expect(cause).toBeInstanceOf(RemoteServiceError);

      const { status } = (cause as RemoteServiceError).error.response;
      expect(status).toEqual(403);
    }
  });
});

describe("proxy service requests", () => {
  it("can proxy request", async () => {
    axiosMock.onAny().reply(200, {
      json: { foo: 42 },
      status_code: 200,
    });
    const { status, data } = await proxyService(
      proxiedServiceConfig,
      requestConfig
    );
    expect(JSON.parse(axiosMock.history.post[0].data)).toEqual({
      ...requestConfig,
      service_id: EXAMPLE_SERVICE_API,
      auth_id: "123",
    });
    expect(status).toEqual(200);
    expect(data).toEqual({ foo: 42 });
  });

  describe.each([[400], [401], [403], [405], [500]])(
    "remote status: %s",
    (statusCode) => {
      it("can proxy remote error", async () => {
        const reason = "Bad request";

        axiosMock.onAny().reply(200, {
          json: {},
          reason,
          status_code: statusCode,
        });

        try {
          await proxyService(proxiedServiceConfig, requestConfig);
          fail("Expected proxyService to throw an error");
        } catch (error) {
          expect(error).toBeInstanceOf(ContextError);
          const { status, statusText } = (
            (error as ContextError).cause as AxiosError
          ).response;
          expect(status).toEqual(statusCode);
          expect(statusText).toEqual(reason);
        }
      });
    }
  );

  it("handle proxy error", async () => {
    axiosMock.onAny().reply(500);

    try {
      await proxyService(proxiedServiceConfig, requestConfig);
      fail("Expected proxyService to throw an error");
    } catch (error) {
      expect(error).toBeInstanceOf(ContextError);

      const { cause } = error as ContextError;

      expect(cause).toBeInstanceOf(RemoteServiceError);

      expect((cause as RemoteServiceError).error.response.status).toEqual(500);
      expect((cause as RemoteServiceError).message).toEqual(
        "Internal Server Error"
      );
    }
  });
});
