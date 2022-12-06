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

import { patternToRegex } from "webext-patterns";
import { castArray } from "lodash";
import { type Availability } from "@/blocks/types";
import { $safeFind } from "@/helpers";
import { type Entries } from "type-fest";
import { BusinessError } from "@/errors/businessErrors";

export function testMatchPatterns(
  patterns: string[],
  url: string = document.location.href
): boolean {
  for (const pattern of patterns) {
    try {
      if (patternToRegex(pattern).test(url)) {
        return true;
      }
    } catch {
      throw new BusinessError(
        `Pattern not recognized as valid match pattern: ${pattern}`
      );
    }
  }

  return false;
}

function testUrlPattern(
  pattern: string | URLPatternInit,
  url: string = document.location.href
): boolean {
  let compiled;

  try {
    compiled = new URLPattern(pattern);
  } catch {
    if (typeof pattern === "object") {
      for (const [key, entry] of Object.entries(pattern) as Entries<
        typeof pattern
      >) {
        try {
          void new URLPattern({ [key]: entry });
        } catch {
          throw new BusinessError(
            `Pattern for ${key} not recognized as a valid url pattern: ${entry}`
          );
        }
      }
    }

    // If pattern is an object, one of the entries should trigger the exception above
    throw new BusinessError(
      `Pattern not recognized as a valid url pattern: ${JSON.stringify(
        pattern
      )}`
    );
  }

  return compiled.test(url);
}

function testSelector(selector: string): boolean {
  return $safeFind(selector).length > 0;
}

export async function checkAvailable(
  availability: Availability,
  url?: string
): Promise<boolean> {
  const {
    matchPatterns: rawMatchPatterns = [],
    urlPatterns: rawUrlPatterns = [],
    selectors: rawSelectors = [],
  } = availability;

  const matchPatterns = rawMatchPatterns ? castArray(rawMatchPatterns) : [];
  const urlPatterns = rawUrlPatterns ? castArray(rawUrlPatterns) : [];
  const selectors = rawSelectors ? castArray(rawSelectors) : [];

  if (process.env.DEBUG) {
    const result = {
      matchPatterns:
        matchPatterns.length === 0 || testMatchPatterns(matchPatterns),
      urlPatterns:
        urlPatterns.length === 0 ||
        urlPatterns.some((pattern) => testUrlPattern(pattern)),
      selectors:
        selectors.length === 0 ||
        selectors.some((selector) => testSelector(selector)),
    };

    console.debug(
      "Availability test for",
      document.location.href,
      "vs.",
      availability,
      "had result",
      result
    );
  }

  // Check matchPatterns and urlPatterns first b/c they're faster than searching selectors

  if (matchPatterns.length > 0 && !testMatchPatterns(matchPatterns, url)) {
    return false;
  }

  if (
    urlPatterns.length > 0 &&
    !urlPatterns.some((pattern) => testUrlPattern(pattern))
  ) {
    return false;
  }

  if (
    selectors.length > 0 &&
    !selectors.some((selector) => testSelector(selector))
  ) {
    return false;
  }

  return true;
}
