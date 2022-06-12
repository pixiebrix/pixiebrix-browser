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

import { BusinessError } from "@/errors/businessErrors";
import { SerializableAxiosError } from "@/errors/networkErrorHelpers";

/**
 * @file ONLY KEEP ACTUAL ERRORS IN HERE.
 * Functions go in errorHelpers.ts
 * This helps avoids circular references.
 */

/**
 * Base class for request errors from client to 3rd-party service.
 */
export class ClientRequestError extends BusinessError {
  override name = "ClientRequestError";
  // Specialize the cause type
  override readonly cause: SerializableAxiosError;

  constructor(message: string, options: { cause: SerializableAxiosError }) {
    super(message, options);
    // This assignment seems to be required in Chrome 102 to ensure the cause is serialized by serialize-error
    // https://github.com/pixiebrix/pixiebrix-extension/issues/3613
    this.cause = options.cause;
  }
}

/**
 * An error response from a 3rd party API.
 */
export class RemoteServiceError extends ClientRequestError {
  override name = "RemoteServiceError";
}

/**
 * An error triggered by a failed network request due to missing permissions
 *
 * - Blocked by browser due to CORS
 *
 * @see ClientNetworkError
 */
export class ClientNetworkPermissionError extends ClientRequestError {
  override name = "ClientNetworkPermissionError";
}

/**
 * An error triggered by a failed network request that did not receive a response.
 *
 * - Request timeout
 * - The host doesn't exist (DNS failed)
 * - Blocked by browser due to HTTPS certificate
 * - Blocked by browser extension
 *
 * @see RemoteServiceError
 * @see ClientNetworkError
 */
export class ClientNetworkError extends ClientRequestError {
  override name = "ClientNetworkError";
}
