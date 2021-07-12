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

export class ComponentNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComponentNotFoundError";
  }
}

export class FrameworkNotFound extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FrameworkNotFound";
  }
}

export function ignoreNotFound<T>(factory: () => T): T | null {
  try {
    return factory();
  } catch (error) {
    if (
      error instanceof ComponentNotFoundError ||
      error instanceof FrameworkNotFound
    ) {
      return null;
    }
    throw error;
  }
}
