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

import { Schema, SchemaProperties } from "@/core";

/**
 * Return the names of top-level required properties that are missing
 */
export function missingProperties(
  schema: Schema,
  obj: Record<string, any>
): string[] {
  const acc = [];
  for (const propertyKey of schema.required ?? []) {
    const property = schema.properties[propertyKey];
    if (typeof property === "object" && property?.type === "string") {
      const value = obj[propertyKey];
      if ((value ?? "").trim().length === 0) {
        acc.push(propertyKey);
      }
    }
  }

  return acc;
}

export function inputProperties(inputSchema: Schema): SchemaProperties {
  if (typeof inputSchema === "object" && "properties" in inputSchema) {
    return inputSchema.properties;
  }

  return inputSchema as SchemaProperties;
}

/**
 * True if the script is executing in a web browser context.
 */
export const IS_BROWSER =
  typeof window !== "undefined" && typeof window.document !== "undefined";

export function $safeFind(
  selector: string,
  parent: Document | Element | JQuery<HTMLElement | Document> = document
): JQuery {
  return $(parent).find(selector);
}
