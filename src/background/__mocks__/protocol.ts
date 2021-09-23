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

jest.mock("webext-detect-page");

import {
  HandlerOptions,
  isErrorResponse,
  SerializableResponse,
  toErrorResponse,
} from "@/messaging/protocol";

import * as detect from "webext-detect-page";

import { deserializeError } from "serialize-error";

const MESSAGE_PREFIX = "@@pixiebrix/background-mock/";

export function liftBackground<
  TArguments extends unknown[],
  R extends SerializableResponse
>(
  type: string,
  method: (...args: TArguments) => Promise<R>,
  { asyncResponse = true }: HandlerOptions = {}
): (...args: TArguments) => Promise<R> {
  const fullType = `${MESSAGE_PREFIX}${type}`;

  return async (...args: TArguments) => {
    console.debug(`running fake ${fullType}`, { fullType, args });

    if (!asyncResponse) {
      throw new Error("background notifications not implemented");
    }

    (detect.isBackgroundPage as any).mockReturnValue(true);

    try {
      let handlerResult: unknown;

      try {
        handlerResult = await method(...args);
      } catch (error: unknown) {
        console.log("Error running method", error);
        handlerResult = toErrorResponse(fullType, error);
      }

      if (isErrorResponse(handlerResult)) {
        throw deserializeError(handlerResult.$$error);
      } else {
        return handlerResult as R;
      }
    } finally {
      (detect.isBackgroundPage as any).mockReturnValue(false);
    }
  };
}
