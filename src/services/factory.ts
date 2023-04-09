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

import { produce } from "immer";
import { renderMustache } from "@/runtime/mapArgs";
import { testMatchPatterns } from "@/blocks/available";
import { isEmpty, castArray, uniq, compact } from "lodash";
import urljoin from "url-join";
import { type AxiosRequestConfig } from "axios";
import { isAbsoluteUrl, safeParseUrl } from "@/utils";
import { missingProperties } from "@/helpers";
import { BusinessError, NotConfiguredError } from "@/errors/businessErrors";
import { IncompatibleServiceError } from "@/errors/genericErrors";
import { type Schema, type UiSchema } from "@/types/schemaTypes";
import {
  type AuthData,
  type BasicAuthenticationDefinition,
  type KeyAuthenticationDefinition,
  type OAuth2AuthenticationDefinition,
  type OAuth2AuthorizationGrantDefinition,
  type OAuth2Context,
  type SanitizedConfig,
  Service,
  type SecretsConfig,
  type ServiceDefinition,
  type TokenAuthenticationDefinition,
  type TokenContext,
} from "@/types/serviceTypes";
import { type SemVerString } from "@/types/registryTypes";

/**
 * A service created from a local definition. Has the ability to authenticate requests because it has
 * access to authenticate secrets.
 */
class LocalDefinedService<
  TDefinition extends ServiceDefinition = ServiceDefinition
> extends Service {
  private readonly _definition: TDefinition;

  public readonly schema: Schema;
  public readonly uiSchema: UiSchema;

  public readonly hasAuth: boolean;

  public readonly version: SemVerString;

  constructor(definition: TDefinition) {
    const { id, name, description, icon, version } = definition.metadata;
    super(id, name, description, icon);
    this._definition = definition;
    this.schema = this._definition.inputSchema;
    this.uiSchema = this._definition.uiSchema;
    this.hasAuth = !isEmpty(this._definition.authentication);
    this.version = version;
  }

  /**
   * Return true if this service can be used to authenticate against the given URL.
   */
  isAvailable(url: string): boolean {
    const patterns = castArray(
      this._definition.isAvailable?.matchPatterns ?? []
    );
    return patterns.length === 0 || testMatchPatterns(patterns, url);
  }

  /**
   * Return true if service exchanges credentials for a bearer token
   */
  get isToken(): boolean {
    return (
      this._definition.authentication != null &&
      "token" in this._definition.authentication
    );
  }

  /**
   * Return true if service uses OAuth2 authentication
   */
  get isOAuth2(): boolean {
    return (
      this._definition.authentication != null &&
      "oauth2" in this._definition.authentication
    );
  }

  /**
   * Return true if service uses basic authentication
   * @since 1.7.16
   */
  get isBasicHttpAuth(): boolean {
    return (
      this._definition.authentication != null &&
      "basic" in this._definition.authentication
    );
  }

  /**
   * Return true if service uses OAuth2 authorization grant
   */
  get isAuthorizationGrant(): boolean {
    return (
      this.isOAuth2 &&
      (this._definition.authentication as OAuth2AuthorizationGrantDefinition)
        .oauth2.grantType === "authorization_code"
    );
  }

  /**
   * Returns origins that require permissions to use the service
   */
  getOrigins(serviceConfig: SanitizedConfig): string[] {
    const patterns = castArray(
      this._definition.isAvailable?.matchPatterns ?? []
    );

    if (
      this._definition.authentication != null &&
      "baseURL" in this._definition.authentication
    ) {
      // Convert into a real match pattern: https://developer.chrome.com/docs/extensions/mv3/match_patterns/
      const baseUrlTemplate = this._definition.authentication.baseURL;
      const baseUrl = safeParseUrl(
        renderMustache(baseUrlTemplate, serviceConfig)
      );

      if (baseUrl.hostname) {
        // Ignore invalid URLs. When the user makes a request, they'll get an error that it's an invalid URL
        patterns.push(baseUrl.href + (baseUrl.href.endsWith("/") ? "*" : "/*"));
      } else {
        console.warn("Invalid baseURL provided by configuration", {
          baseUrlTemplate,
          baseUrl,
          serviceConfig,
        });
      }
    }

    if (this.isOAuth2) {
      const oauth = this._definition
        .authentication as OAuth2AuthenticationDefinition;

      // Don't add wildcard because the URL can't change per request.
      const authUrls = [oauth.oauth2.authorizeUrl, oauth.oauth2.tokenUrl]
        .map((template) => renderMustache(template, serviceConfig))
        .filter((url) => Boolean(safeParseUrl(url).hostname));
      patterns.push(...authUrls);
    }

    if (this.isToken) {
      const tokenUrl = (
        this._definition as ServiceDefinition<TokenAuthenticationDefinition>
      ).authentication.token.url;
      patterns.push(renderMustache(tokenUrl, serviceConfig));
    }

    return uniq(compact(patterns));
  }

  getTokenContext(serviceConfig: SecretsConfig): TokenContext {
    if (this.isToken) {
      const definition: TokenContext = (
        this._definition.authentication as TokenAuthenticationDefinition
      ).token;
      // Console.debug("token context", { definition, serviceConfig });
      return renderMustache<TokenContext>(definition, serviceConfig);
    }

    return undefined;
  }

  getOAuth2Context(serviceConfig: SecretsConfig): OAuth2Context {
    if (this.isOAuth2) {
      const definition: OAuth2Context = (
        this._definition.authentication as OAuth2AuthenticationDefinition
      ).oauth2;
      console.debug("getOAuth2Context", { definition, serviceConfig });
      return renderMustache<OAuth2Context>(definition, serviceConfig);
    }

    return undefined;
  }

  /**
   * Test that the request URL can be called by this service.
   * @throws IncompatibleServiceError if the resulting URL cannot by called by this service
   */
  private checkRequestUrl(
    baseURL: string | null,
    requestConfig: AxiosRequestConfig
  ): void {
    const absoluteURL =
      baseURL && !isAbsoluteUrl(requestConfig.url)
        ? urljoin(baseURL, requestConfig.url)
        : requestConfig.url;

    if (!this.isAvailable(absoluteURL)) {
      throw new IncompatibleServiceError(
        `Service ${this.id} cannot be used to authenticate requests to ${absoluteURL}`
      );
    }
  }

  private authenticateRequestKey(
    serviceConfig: SecretsConfig,
    requestConfig: AxiosRequestConfig
  ): AxiosRequestConfig {
    if (!this.isAvailable(requestConfig.url)) {
      throw new IncompatibleServiceError(
        `Service ${this.id} cannot be used to authenticate requests to ${requestConfig.url}`
      );
    }

    const {
      baseURL,
      headers = {},
      params = {},
    } = renderMustache<KeyAuthenticationDefinition>(
      (this._definition.authentication as KeyAuthenticationDefinition) ?? {},
      serviceConfig
    );

    if (!baseURL && !isAbsoluteUrl(requestConfig.url)) {
      throw new Error(
        "Must use absolute URLs for services that don't define a baseURL"
      );
    }

    const result = produce(requestConfig, (draft) => {
      requestConfig.baseURL = baseURL;
      draft.headers = { ...draft.headers, ...headers };
      draft.params = { ...draft.params, ...params };
    });

    this.checkRequestUrl(baseURL, requestConfig);

    return result;
  }

  private authenticateBasicRequest(
    serviceConfig: SecretsConfig,
    requestConfig: AxiosRequestConfig
  ): AxiosRequestConfig {
    if (!this.isAvailable(requestConfig.url)) {
      throw new IncompatibleServiceError(
        `Service ${this.id} cannot be used to authenticate requests to ${requestConfig.url}`
      );
    }

    const {
      baseURL,
      basic,
      headers = {},
    } = renderMustache<BasicAuthenticationDefinition>(
      this._definition.authentication as BasicAuthenticationDefinition,
      serviceConfig
    );

    if (isEmpty(basic.username) && isEmpty(basic.password)) {
      throw new BusinessError(
        "At least one of username and password is required for basic authentication"
      );
    }

    if (!baseURL && !isAbsoluteUrl(requestConfig.url)) {
      throw new Error(
        "Must use absolute URLs for services that don't define a baseURL"
      );
    }

    const result = produce(requestConfig, (draft) => {
      requestConfig.baseURL = baseURL;
      draft.headers = {
        ...draft.headers,
        Authorization: `Basic ${btoa(
          [basic.username, basic.password].join(":")
        )}`,
        ...headers,
      };
    });

    this.checkRequestUrl(baseURL, requestConfig);

    return result;
  }

  private authenticateRequestToken(
    serviceConfig: SecretsConfig,
    requestConfig: AxiosRequestConfig,
    tokenData: AuthData
  ): AxiosRequestConfig {
    if (isEmpty(tokenData)) {
      throw new Error("Empty token data provided");
    }

    const { baseURL, headers = {} } = renderMustache(
      this._definition.authentication as
        | OAuth2AuthenticationDefinition
        | TokenAuthenticationDefinition,
      { ...serviceConfig, ...tokenData }
    );

    if (!baseURL && !isAbsoluteUrl(requestConfig.url)) {
      throw new Error(
        "Must use absolute URLs for services that don't define a baseURL"
      );
    }

    const result = produce(requestConfig, (draft) => {
      requestConfig.baseURL = baseURL;
      draft.headers = { ...draft.headers, ...headers };
    });

    this.checkRequestUrl(baseURL, requestConfig);

    return result;
  }

  authenticateRequest(
    serviceConfig: SecretsConfig,
    requestConfig: AxiosRequestConfig,
    authData?: AuthData
  ): AxiosRequestConfig {
    const missing = missingProperties(this.schema, serviceConfig);
    if (missing.length > 0) {
      throw new NotConfiguredError(
        `Service ${this.id} is not fully configured`,
        this.id,
        missing
      );
    }

    if (this.isOAuth2 || this.isToken) {
      return this.authenticateRequestToken(
        serviceConfig,
        requestConfig,
        authData
      );
    }

    if (this.isBasicHttpAuth) {
      return this.authenticateBasicRequest(serviceConfig, requestConfig);
    }

    return this.authenticateRequestKey(serviceConfig, requestConfig);
  }
}

export function fromJS(component: ServiceDefinition): LocalDefinedService {
  return new LocalDefinedService(component);
}
