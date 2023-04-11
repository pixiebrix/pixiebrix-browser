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

import { type MessageContext } from "@/types/loggerTypes";
import { backgroundTarget as bg, messenger } from "webext-messenger";
import { serializeError } from "serialize-error";
import { selectError, shouldErrorBeIgnored } from "@/errors/errorHelpers";
import { expectContext } from "@/utils/expectContext";
import { getContextName } from "webext-detect-page";

expectContext(
  "extension",
  "reportError requires access background messenger API"
);

interface ErrorReportOptions {
  /** Optional context for error telemetry */
  context?: MessageContext;

  /** Additionally log error to the browser console (default=true) */
  logToConsole?: boolean;
}

/**
 * Report an error for local logs, remote telemetry, etc.
 * @param errorLike the error object, error event, or string to report. Callers should provide Error objects when
 *  possible for accurate stack traces.
 * @param context Optional context for error telemetry
 * @param logToConsole Additionally log error to the browser console (default=true)
 */
export default function reportError(
  errorLike: unknown, // It might also be an ErrorEvent or string
  { context = {}, logToConsole = true }: ErrorReportOptions = {}
): void {
  if (logToConsole) {
    console.error(errorLike, { context });
  }

  if (shouldErrorBeIgnored(errorLike, context)) {
    console.debug("Ignoring error matching IGNORED_ERROR_PATTERNS", {
      error: errorLike,
    });
    return;
  }

  try {
    messenger(
      // Low-level direct API call to avoid calls outside reportError
      "RECORD_ERROR",
      { isNotification: true },
      bg,
      serializeError(selectError(errorLike)),
      {
        ...context,
        // Add on the reporter side of the message. On the receiving side it would always be `background`
        pageName: getContextName(),
      }
    );
  } catch (reportingError) {
    // The messenger does not throw async errors on "notifiers" but if this is
    // called in the background the call will be executed directly and it could
    // theoretically throw a synchronous error
    console.error("An error occurred when reporting an error", {
      originalError: errorLike,
      reportingError,
    });
  }
}
