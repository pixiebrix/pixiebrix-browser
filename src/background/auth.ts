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

import axios, { AxiosResponse } from "axios";
import { readStorageWithMigration, setStorage } from "@/chrome";
import { IService, AuthData, RawServiceConfiguration } from "@/core";
import { browser } from "webextension-polyfill-ts";
import {
  computeChallenge,
  generateVerifier,
  getRandomString,
} from "@/vendors/pkce";
import { BusinessError, getErrorMessage } from "@/errors";
import { expectBackgroundPage } from "@/utils/expectContext";

const OAUTH2_STORAGE_KEY = "OAUTH2";

async function setCachedAuthData<TAuthData extends Partial<AuthData>>(
  key: string,
  data: TAuthData
): Promise<void> {
  expectBackgroundPage(
    "Only the background page can access oauth2 information"
  );

  const current = await readStorageWithMigration<Record<string, TAuthData>>(
    OAUTH2_STORAGE_KEY
  );
  await setStorage(OAUTH2_STORAGE_KEY, {
    ...current,
    [key]: data,
  });
}

export async function getCachedAuthData(
  key: string
): Promise<AuthData | undefined> {
  expectBackgroundPage(
    "Only the background page can access oauth2 information"
  );

  const current = await readStorageWithMigration<Record<string, AuthData>>(
    OAUTH2_STORAGE_KEY
  );
  if (key in current) {
    // eslint-disable-next-line security/detect-object-injection -- Just checked with `in`
    return current[key];
  }
}

export async function deleteCachedAuthData(key: string): Promise<void> {
  expectBackgroundPage(
    "Only the background page can access oauth2 information"
  );

  const current = await readStorageWithMigration<Record<string, AuthData>>(
    OAUTH2_STORAGE_KEY
  );
  if (Object.prototype.hasOwnProperty.call(current, key)) {
    console.debug(`deleteCachedAuthData: removed data for auth ${key}`);
    // OK because we're guarding with hasOwnProperty
    // eslint-disable-next-line security/detect-object-injection,@typescript-eslint/no-dynamic-delete
    delete current[key];
    await setStorage(OAUTH2_STORAGE_KEY, current);
  } else {
    console.warn(
      `deleteCachedAuthData: No cached auth data exists for key: ${key}`
    );
  }
}

/**
 * Exchange credentials for a token, and cache the token response
 * @param service
 * @param auth
 */
export async function getToken(
  service: IService,
  auth: RawServiceConfiguration
): Promise<AuthData> {
  if (!service.isToken) {
    throw new Error(`Service ${service.id} does not use token authentication`);
  }

  const { url, data: tokenData } = service.getTokenContext(auth.config);

  const { status, statusText, data: responseData } = await axios.post<AuthData>(
    url,
    tokenData
  );

  if (status >= 400) {
    throw new Error(statusText);
  }

  await setCachedAuthData(auth.id, responseData);

  return responseData;
}

export async function launchOAuth2Flow(
  service: IService,
  auth: RawServiceConfiguration
): Promise<AuthData> {
  // Reference: https://github.com/kylpo/salesforce-chrome-oauth/blob/master/index.js
  if (!service.isOAuth2) {
    throw new Error(`Service ${service.id} is not an OAuth2 service`);
  }

  const oauth2 = service.getOAuth2Context(auth.config);

  const {
    code_challenge_method,
    client_secret,
    authorizeUrl: rawAuthorizeUrl,
    tokenUrl: rawTokenUrl,
    ...params
  } = oauth2;

  if (!rawAuthorizeUrl) {
    throw new BusinessError("authorizeUrl is required for oauth2");
  } else if (!rawTokenUrl) {
    throw new BusinessError("tokenUrl is required for oauth2");
  }

  const redirect_uri = browser.identity.getRedirectURL("oauth2");

  // Console.debug("OAuth2 context", {redirect_uri, context: oauth2});

  const authorizeURL = new URL(rawAuthorizeUrl);
  for (const [key, value] of Object.entries({
    redirect_uri,
    response_type: "code",
    display: "page",
    ...params,
  })) {
    authorizeURL.searchParams.set(key, value);
  }

  let code_verifier: string = null;
  let code_challenge: string = null;

  const state = getRandomString(16);
  authorizeURL.searchParams.set("state", state);

  if (code_challenge_method === "S256") {
    code_verifier = generateVerifier();
    code_challenge = await computeChallenge(code_verifier);
    authorizeURL.searchParams.set("code_challenge", code_challenge);
    authorizeURL.searchParams.set(
      "code_challenge_method",
      code_challenge_method
    );
  } else if (code_challenge_method != null) {
    throw new BusinessError(
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- dynamic check; type is `never`
      `Unsupported code challenge method: ${code_challenge_method}`
    );
  }

  const responseUrl = await browser.identity.launchWebAuthFlow({
    url: authorizeURL.toString(),
    interactive: true,
  });

  if (!responseUrl) {
    throw new Error("Authentication cancelled");
  }

  const authResponse = new URL(responseUrl);

  // Console.debug("OAuth authorize response", authResponse);

  const error = authResponse.searchParams.get("error");
  if (error) {
    throw new Error(
      authResponse.searchParams.get("error_description") ?? error
    );
  }

  if (authResponse.searchParams.get("state") !== state) {
    throw new Error("OAuth2 state mismatch");
  }

  const tokenURL = new URL(rawTokenUrl);

  const tokenBody: Record<string, string> = {
    redirect_uri,
    grant_type: "authorization_code",
    code: authResponse.searchParams.get("code"),
    client_id: params.client_id,
  };

  if (client_secret) {
    tokenBody.client_secret = client_secret;
  }

  if (code_verifier) {
    tokenBody.code_verifier = code_verifier;
  }

  const tokenParams = new URLSearchParams();
  for (const [param, value] of Object.entries(tokenBody)) {
    tokenParams.set(param, value.toString());
  }

  let tokenResponse: AxiosResponse;

  try {
    tokenResponse = await axios.post(tokenURL.toString(), tokenParams, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  } catch (error: unknown) {
    console.error(error);
    throw new Error(`Error getting OAuth2 token: ${getErrorMessage(error)}`);
  }

  const { data, status, statusText } = tokenResponse;

  if (status >= 400) {
    throw new Error(
      `Error getting OAuth2 token: ${statusText ?? "Unknown error"}`
    );
  } else if (typeof data === "string") {
    let parsed;
    try {
      parsed = new URLSearchParams(data);
    } catch {
      throw new Error(
        "Expected application/x-www-form-urlencoded data for response"
      );
    }

    if (parsed.get("error")) {
      throw new Error(parsed.get("error_description") ?? parsed.get("error"));
    }

    const json: Record<string, string> = {};
    for (const [key, value] of parsed.entries()) {
      // Coming from the URL search parameter so will be safe
      // eslint-disable-next-line security/detect-object-injection
      json[key] = value;
    }

    await setCachedAuthData(auth.id, json);
    return json as AuthData;
  } else if (typeof data === "object") {
    await setCachedAuthData(auth.id, data);
    return data as AuthData;
  } else {
    throw new TypeError(
      "Error getting OAuth2 token: unexpected response format"
    );
  }
}
