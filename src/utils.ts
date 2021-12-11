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

import {
  isEmpty,
  mapValues,
  partial,
  partialRight,
  negate,
  countBy,
  maxBy,
  entries,
  last,
  flow,
  head,
  ObjectIterator,
  zip,
  pickBy,
  isPlainObject,
  compact,
  unary,
} from "lodash";
import { Primitive } from "type-fest";
import { ApiVersion, SafeString } from "@/core";
import { UnknownObject } from "@/types";

/**
 * Create a Formik field name, validating the individual path parts.
 * @param baseFieldName The base field name
 * @param rest the other Formik field name path parts
 * @throws Error if a path part is invalid
 */
export function joinName(
  baseFieldName: string | null,
  ...rest: string[]
): string {
  const fieldNames = compact(rest);

  if (fieldNames.length === 0) {
    throw new Error(
      "Expected one or more field names to join with the main path"
    );
  }

  if (fieldNames.some((x) => x.includes("."))) {
    throw new Error("Formik path parts cannot contain periods");
  }

  return compact([baseFieldName, ...fieldNames]).join(".");
}

export function mostCommonElement<T>(items: T[]): T {
  // https://stackoverflow.com/questions/49731282/the-most-frequent-item-of-an-array-using-lodash
  return flow(countBy, entries, partialRight(maxBy, last), head)(items) as T;
}

export function isGetter(
  object: Record<string, unknown>,
  property: string
): boolean {
  return Boolean(Object.getOwnPropertyDescriptor(object, property)?.get);
}

/**
 * Return all property names (including non-enumerable) in the prototype hierarchy.
 */
export function getAllPropertyNames(object: Record<string, unknown>): string[] {
  const properties = new Set<string>();
  let current = object;
  while (current) {
    for (const name of Object.getOwnPropertyNames(current)) {
      properties.add(name);
    }

    current = Object.getPrototypeOf(current);
  }

  return [...properties.values()];
}

export async function waitAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      resolve();
    });
  });
}

/**
 * Returns a new object with all the values from the original resolved
 */
export async function resolveObj<T>(
  object: Record<string, Promise<T>>
): Promise<Record<string, T>> {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(object).map(async ([k, v]) => [k, await v])
    )
  );
}

/**
 * Same as lodash mapValues but supports promises
 */
export async function asyncMapValues<T, TResult>(
  mapping: T,
  function_: ObjectIterator<T, Promise<TResult>>
): Promise<{ [K in keyof T]: TResult }> {
  const entries = Object.entries(mapping);
  const values = await Promise.all(
    entries.map(async ([key, value]) => function_(value, key, mapping))
  );
  return Object.fromEntries(
    zip(entries, values).map(([[key], value]) => [key, value])
  ) as any;
}

export const sleep = async (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export async function awaitValue<T>(
  valueFactory: () => T,
  {
    waitMillis,
    retryMillis = 50,
    predicate = negate(isEmpty),
  }: {
    waitMillis: number;
    retryMillis?: number;
    predicate?: (value: T) => boolean;
  }
): Promise<T> {
  const start = Date.now();
  let value: T;
  do {
    value = valueFactory();
    if (predicate(value)) {
      return value;
    }

    // eslint-disable-next-line no-await-in-loop -- intentionally blocking the loop
    await sleep(retryMillis);
  } while (Date.now() - start < waitMillis);

  throw new TimeoutError(`Value not found after ${waitMillis} milliseconds`);
}

export function isPrimitive(value: unknown): value is Primitive {
  if (typeof value === "object") {
    return value === null;
  }

  return typeof value !== "function";
}

/**
 * Recursively pick entries that match property
 * @param obj an object
 * @param predicate predicate returns true to include an entry
 * @see pickBy
 */
export function deepPickBy(
  object: unknown,
  predicate: (value: unknown) => boolean
): unknown {
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof#typeof_null
  // `typeof null === "object"`, so have to check for it before the "object" check below
  if (object == null) {
    return null;
  }

  if (Array.isArray(object)) {
    return object.map((item) => deepPickBy(item, predicate));
  }

  if (typeof object === "object") {
    return mapValues(
      pickBy(object, (value) => predicate(value)),
      (value) => deepPickBy(value, predicate)
    );
  }

  return object;
}

export function removeUndefined(object: unknown): unknown {
  return deepPickBy(object, (value: unknown) => typeof value !== "undefined");
}

export function boolean(value: unknown): boolean {
  if (typeof value === "string") {
    return ["true", "t", "yes", "y", "on", "1"].includes(
      value.trim().toLowerCase()
    );
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return false;
}

export function clone<T extends Record<string, unknown>>(object: T): T {
  return Object.assign(Object.create(null), object);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value && typeof value === "object";
}

export function clearObject(object: Record<string, unknown>): void {
  for (const member in object) {
    if (Object.prototype.hasOwnProperty.call(object, member)) {
      // Checking to ensure own property
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete,security/detect-object-injection
      delete object[member];
    }
  }
}

/**
 * Set values to undefined that can't be sent across the boundary between the host site context and the
 * content script context
 */
export function cleanValue(
  value: unknown[],
  maxDepth?: number,
  depth?: number
): unknown[];
export function cleanValue(
  value: Record<string, unknown>,
  maxDepth?: number,
  depth?: number
): Record<string, unknown>;
export function cleanValue(
  value: unknown,
  maxDepth?: number,
  depth?: number
): unknown;
export function cleanValue(value: unknown, maxDepth = 5, depth = 0): unknown {
  const recurse = partial(cleanValue, partial.placeholder, maxDepth, depth + 1);

  if (depth > maxDepth) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map((x) => recurse(x));
  }

  if (typeof value === "object" && value != null) {
    return mapValues(value, recurse);
  }

  if (typeof value === "function" || typeof value === "symbol") {
    return undefined;
  }

  return value;
}

/**
 * Error indicating input elements to a block did not match the schema.
 */
export class InvalidPathError extends Error {
  public readonly path: string;

  readonly input: unknown;

  constructor(message: string, path: string) {
    super(message);
    this.name = "InvalidPathError";
    this.path = path;
  }
}

export function isNullOrBlank(value: unknown): boolean {
  if (value == null) {
    return true;
  }

  return typeof value === "string" && value.trim() === "";
}

export function excludeUndefined(object: unknown): unknown {
  if (isPlainObject(object) && typeof object === "object") {
    return mapValues(
      pickBy(object, (x) => x !== undefined),
      excludeUndefined
    );
  }

  return object;
}

export class PromiseCancelled extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromiseCancelled";
  }
}

/**
 * Creates a new promise that's rejected if isCancelled returns true.
 * @throws PromiseCancelled
 */
export async function rejectOnCancelled<T>(
  promise: Promise<T>,
  isCancelled: () => boolean
): Promise<T> {
  let rv: T;
  try {
    rv = await promise;
  } catch (error) {
    if (isCancelled()) {
      throw new PromiseCancelled("Promise was cancelled");
    }

    throw error;
  }

  if (isCancelled()) {
    throw new PromiseCancelled("Promise was cancelled");
  }

  return rv;
}

export function evaluableFunction(
  function_: (...parameters: unknown[]) => unknown
): string {
  return "(" + function_.toString() + ")()";
}

/**
 * Lift a unary function to pass through null/undefined.
 */
export function optional<T extends (argument: unknown) => unknown>(
  function_: T
): (argument: null | Parameters<T>[0]) => ReturnType<T> | null {
  return (argument: Parameters<T>[0]) => {
    if (argument == null) {
      return null;
    }

    return function_(argument) as ReturnType<T>;
  };
}

/**
 * Returns true if `url` is an absolute URL, based on whether the URL contains a schema
 */
export function isAbsoluteUrl(url: string): boolean {
  return /(^|:)\/\//.test(url);
}

export const SPACE_ENCODED_VALUE = "%20";

export function makeURL(
  url: string,
  parameters: Record<string, string | number | boolean> | undefined = {},
  spaceEncoding: "plus" | "percent" = "plus"
): string {
  // https://javascript.info/url#searchparams
  const result = new URL(url);
  for (const [name, value] of Object.entries(parameters ?? {})) {
    if ((value ?? "") !== "") {
      result.searchParams.append(name, String(value));
    }
  }

  const fullURL = result.toString();

  if (spaceEncoding === "plus" || result.search.length === 0) {
    return fullURL;
  }

  return fullURL.replace(
    result.search,
    result.search.replaceAll("+", SPACE_ENCODED_VALUE)
  );
}

export async function allSettledValues<T = unknown>(
  promises: Array<Promise<T>>
): Promise<T[]> {
  const settled = await Promise.allSettled(promises);
  return settled
    .filter(
      (promise): promise is PromiseFulfilledResult<Awaited<T>> =>
        promise.status === "fulfilled"
    )
    .map(({ value }) => value);
}

export async function allSettledRejections(
  promises: Array<Promise<unknown>>
): Promise<unknown[]> {
  const settled = await Promise.allSettled(promises);
  return settled
    .filter(
      (promise): promise is PromiseRejectedResult =>
        promise.status === "rejected"
    )
    .map(({ reason }) => reason);
}

export function freshIdentifier(
  root: SafeString,
  identifiers: string[],
  options: { includeFirstNumber?: boolean; startNumber?: number } = {}
): string {
  const { includeFirstNumber, startNumber } = {
    includeFirstNumber: false,
    startNumber: 1,
    ...options,
  };

  // eslint-disable-next-line security/detect-non-literal-regexp -- guarding with SafeString
  const regexp = new RegExp(`^${root}(?<number>\\d+)$`);

  const used = identifiers
    .map((identifier) =>
      identifier === root ? startNumber : regexp.exec(identifier)?.groups.number
    )
    .filter((x) => x != null)
    .map((x) => Number(x));
  const next = Math.max(startNumber - 1, ...used) + 1;

  if (next === startNumber && !includeFirstNumber) {
    return root;
  }

  return `${root}${next}`;
}

/** Like `new URL(url)` except it never throws and always returns an URL object, empty if the url is invalid */
export function safeParseUrl(url: string): URL {
  try {
    return new URL(url);
  } catch {
    return new URL("invalid-url://");
  }
}

export function isApiVersionAtLeast(
  is: ApiVersion,
  atLeast: ApiVersion
): boolean {
  const isNumber = Number(is.slice(1));
  const atLeastNumber = Number(atLeast.slice(1));

  return isNumber >= atLeastNumber;
}

export function getProperty(object: UnknownObject, property: string) {
  if (Object.prototype.hasOwnProperty.call(object, property)) {
    // Checking for hasOwnProperty
    // eslint-disable-next-line security/detect-object-injection
    return object[property];
  }
}

export async function runInMillis<TResult>(
  factory: () => Promise<TResult>,
  maxMillis: number
): Promise<TResult> {
  const timeout = Symbol("timeout");
  const value = await Promise.race([
    factory(),
    sleep(maxMillis).then(() => timeout),
  ]);

  if (value === timeout) {
    throw new TimeoutError(`Method did not complete in ${maxMillis}ms`);
  }

  return value as TResult;
}

/** Loop an iterable with the ability to place `await` in the loop itself */
export async function asyncLoop<Item>(
  iterable: Iterable<Item>,
  iteratee: (item: Item) => Promise<void>
): Promise<void> {
  await Promise.all([...iterable].map(unary(iteratee)));
}
