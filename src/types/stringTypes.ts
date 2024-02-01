/*
 * Copyright (C) 2024 PixieBrix, Inc.
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

/**
 * A known UUID v4 string
 * @see uuidv4
 * @see isUUID
 */
export type UUID = string & {
  // Nominal subtyping
  _uuidBrand: never;
};

/**
 * An ISO timestamp string
 */
export type Timestamp = string & {
  // Nominal subtyping
  _uuidTimestamp: never;
};

/**
 * An UTC timestamp followed by a sequence number valid in the current context.
 * Useful to determine order of two calls to getTimedSequence.
 */
export type TimedSequence = string & {
  // Nominal subtyping
  _timedSequence: never;
};

/**
 * A string known not to be tainted with user-generated input.
 */
export type SafeString = string & {
  // Nominal subtyping
  _safeStringBrand: never;
};

/**
 * Rendered HTML that has been sanitized.
 * @see sanitize
 */
export type SafeHTML = string & {
  // Nominal subtyping
  _safeHTMLBrand: never;
};
