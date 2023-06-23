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

/**
 * @file Generic helper methods.
 */

import {
  compact,
  countBy,
  entries,
  flow,
  head,
  isEmpty,
  isPlainObject,
  last,
  mapValues,
  maxBy,
  negate,
  type ObjectIterator,
  partial,
  partialRight,
  pickBy,
  split,
  unary,
  zip,
} from "lodash";
import { type JsonObject, type Primitive } from "type-fest";
import safeJsonStringify from "json-stringify-safe";
import pMemoize from "p-memoize";
import { TimeoutError } from "p-timeout";
import { type Schema } from "@/types/schemaTypes";
import { type SafeString } from "@/types/stringTypes";
import { type ApiVersion } from "@/types/runtimeTypes";
import { type UnknownObject } from "@/types/objectTypes";
import { type RegistryId } from "@/types/registryTypes";

const specialCharsRegex = /[\s.[\]]/;

/**
 * Create a Formik field name, validating the individual path parts.
 * Wraps parts with special characters in brackets, so Formik treat it as a single property name.
 * Stringifies numeric property access as "foo.0.bar"
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

  let path = baseFieldName || "";
  for (const fieldName of fieldNames) {
    if (specialCharsRegex.test(fieldName)) {
      path += `["${fieldName}"]`;
    } else if (path === "") {
      path = fieldName;
    } else {
      path += `.${fieldName}`;
    }
  }

  return path;
}

/**
 * Join parts of a path, ignoring null/blank parts.
 * Works faster than joinName.
 * Use this one when there're no special characters in the name parts or
 * the parts contain already joined paths rather than individual property names
 * @param nameParts the parts of the name
 */
export function joinPathParts(...nameParts: Array<string | number>): string {
  // Don't use lodash.compact and lodash.isEmpty since they treat 0 as falsy
  return nameParts.filter((x) => x != null && x !== "").join(".");
}

/**
 * Helper method to get the schema of a sub-property. Does not currently handle array indexes or allOf/oneOf/anyOf.
 * @param schema the JSON Schema
 * @param path the property path
 */
export function getSubSchema(schema: Schema, path: string): Schema {
  const parts = split(path, ".");
  let subSchema: Schema | boolean = schema;

  for (const part of parts) {
    if (typeof subSchema === "boolean") {
      throw new TypeError(`Invalid property path: ${path}`);
    }

    // eslint-disable-next-line security/detect-object-injection -- expected that this is called locally
    subSchema = subSchema.properties?.[part];
  }

  if (subSchema == null) {
    throw new TypeError(`Invalid property path: ${path}`);
  }

  if (typeof subSchema === "boolean") {
    throw new TypeError(`Invalid property path: ${path}`);
  }

  return subSchema;
}

export function mostCommonElement<T>(items: T[]): T {
  // https://stackoverflow.com/questions/49731282/the-most-frequent-item-of-an-array-using-lodash
  return flow(countBy, entries, partialRight(maxBy, last), head)(items) as T;
}

export function isGetter(obj: Record<string, unknown>, prop: string): boolean {
  return Boolean(Object.getOwnPropertyDescriptor(obj, prop)?.get);
}

/**
 * Return all property names (including non-enumerable) in the prototype hierarchy.
 */
export function getAllPropertyNames(obj: Record<string, unknown>): string[] {
  const props = new Set<string>();
  let current = obj;
  while (current) {
    for (const name of Object.getOwnPropertyNames(current)) {
      props.add(name);
    }

    current = Object.getPrototypeOf(current);
  }

  return [...props.values()];
}

export async function waitAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      resolve();
    });
  });
}

export async function setAnimationFrameInterval(
  callback: () => void,
  { signal }: { signal: AbortSignal }
): Promise<void> {
  while (!signal.aborted) {
    // eslint-disable-next-line no-await-in-loop -- intentional
    await waitAnimationFrame();
    callback();
  }
}

export const sleep = async (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

export async function waitForBody(): Promise<void> {
  while (!document.body) {
    // eslint-disable-next-line no-await-in-loop -- Polling pattern
    await sleep(20);
  }
}

/**
 * Returns a new object with all the values from the original resolved
 */
export async function resolveObj<T>(
  obj: Record<string, Promise<T>>
): Promise<Record<string, T>> {
  return Object.fromEntries(
    await Promise.all(Object.entries(obj).map(async ([k, v]) => [k, await v]))
  );
}

/**
 * Same as lodash mapValues but supports promises
 */
export async function asyncMapValues<T, TResult>(
  mapping: Record<string, T[keyof T]>,
  fn: ObjectIterator<Record<string, T[keyof T]>, Promise<TResult>>
): Promise<{ [K in keyof T]: TResult }> {
  const entries = Object.entries(mapping);
  const values = await Promise.all(
    entries.map(async ([key, value]) => fn(value, key, mapping))
  );
  return Object.fromEntries(
    zip(entries, values).map(([[key], value]) => [key, value])
  ) as any;
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
 * Recursively pick entries that match a predicate
 * @param obj an object
 * @param predicate predicate returns true to include an entry
 * @see pickBy
 */
export function deepPickBy(
  obj: unknown,
  predicate: (value: unknown, parent?: unknown) => boolean
): unknown {
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof#typeof_null
  // `typeof null === "object"`, so have to check for it before the "object" check below
  if (obj == null) {
    return null;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepPickBy(item, predicate));
  }

  if (typeof obj === "object") {
    return mapValues(
      pickBy(obj, (value) => predicate(value, obj)),
      (value) => deepPickBy(value, predicate)
    );
  }

  return obj;
}

export function removeUndefined(obj: unknown): unknown {
  return deepPickBy(obj, (value: unknown) => value !== undefined);
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

export function isObject(value: unknown): value is Record<string, unknown> {
  return value && typeof value === "object";
}

export function ensureJsonObject(value: Record<string, unknown>): JsonObject {
  if (!isObject(value)) {
    throw new TypeError("expected object");
  }

  return JSON.parse(safeJsonStringify(value)) as JsonObject;
}

/**
 * Set values to undefined that can't be sent across the boundary between the host site context and the
 * content script context
 */
export function cleanValue(
  value: unknown[],
  maxDepth?: number | undefined,
  depth?: number
): unknown[];
export function cleanValue(
  value: Record<string, unknown>,
  maxDepth?: number | undefined,
  depth?: number
): Record<string, unknown>;
export function cleanValue(
  value: unknown,
  maxDepth?: number | undefined,
  depth?: number
): unknown;
export function cleanValue(
  value: unknown,
  maxDepth: number | undefined,
  depth = 0
): unknown {
  const recurse = partial(cleanValue, partial.placeholder, maxDepth, depth + 1);

  if (maxDepth != null && depth > maxDepth) {
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
  override name = "InvalidPathError";

  public readonly path: string;

  readonly input: unknown;

  constructor(message: string, path: string) {
    super(message);
    this.path = path;
  }
}

export function isNullOrBlank(value: unknown): boolean {
  if (value == null) {
    return true;
  }

  return typeof value === "string" && value.trim() === "";
}

export function excludeUndefined(obj: unknown): unknown {
  if (isPlainObject(obj) && typeof obj === "object") {
    return mapValues(
      pickBy(obj, (x) => x !== undefined),
      excludeUndefined
    );
  }

  return obj;
}

/**
 * Returns true if `url` is an absolute URL, based on whether the URL contains a schema
 */
export function isAbsoluteUrl(url: string): boolean {
  return /(^|:)\/\//.test(url);
}

const SPACE_ENCODED_VALUE = "%20";

// Preserve the previous default for backwards compatibility
// https://github.com/pixiebrix/pixiebrix-extension/pull/3076#discussion_r844564894
export const LEGACY_URL_INPUT_SPACE_ENCODING_DEFAULT = "plus";
export const URL_INPUT_SPACE_ENCODING_DEFAULT = "percent";

export function makeURL(
  url: string,
  params: Record<string, string | number | boolean> = {},
  spaceEncoding: "plus" | "percent" = URL_INPUT_SPACE_ENCODING_DEFAULT
): string {
  // https://javascript.info/url#searchparams
  const result = new URL(url, location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (isNullOrBlank(value)) {
      result.searchParams.delete(key);
    } else {
      result.searchParams.set(key, String(value));
    }
  }

  if (spaceEncoding === "percent" && result.search.length > 0) {
    result.search = result.search.replaceAll("+", SPACE_ENCODED_VALUE);
  }

  return result.href;
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
    .map(Number);
  const next = Math.max(startNumber - 1, ...used) + 1;

  if (next === startNumber && !includeFirstNumber) {
    return root;
  }

  return `${root}${next}`;
}

/** Like `new URL(url)` except it never throws and always returns an URL object, empty if the url is invalid */
export function safeParseUrl(url: string, baseUrl?: string): URL {
  try {
    return new URL(url, baseUrl);
  } catch {
    return new URL("invalid-url://");
  }
}

export function isApiVersionAtLeast(
  is: ApiVersion,
  atLeast: ApiVersion
): boolean {
  const isNum = Number(is.slice(1));
  const atLeastNum = Number(atLeast.slice(1));

  return isNum >= atLeastNum;
}

export function getProperty<TResult = unknown>(
  obj: UnknownObject,
  property: string
): TResult {
  if (Object.hasOwn(obj, property)) {
    // Checking for hasOwn
    // eslint-disable-next-line security/detect-object-injection
    return obj[property] as TResult;
  }
}

/** Loop an iterable with the ability to place `await` in the loop itself */
export async function asyncForEach<Item>(
  iterable: Iterable<Item>,
  iteratee: (item: Item) => Promise<void>
): Promise<void> {
  await Promise.all([...iterable].map(unary(iteratee)));
}

export async function pollUntilTruthy<T>(
  looper: (...args: unknown[]) => Promise<T> | T,
  { maxWaitMillis = Number.MAX_SAFE_INTEGER, intervalMillis = 100 }
): Promise<T | undefined> {
  const endBy = Date.now() + maxWaitMillis;
  do {
    // eslint-disable-next-line no-await-in-loop -- It's a retry loop
    const result = await looper();
    if (result) {
      return result;
    }

    // eslint-disable-next-line no-await-in-loop -- It's a retry loop
    await sleep(intervalMillis);
  } while (Date.now() < endBy);
}

export async function logPromiseDuration<P>(
  title: string,
  promise: Promise<P>
): Promise<P> {
  const start = Date.now();
  try {
    return await promise;
  } finally {
    // Prefer `debug` level; `console.time` has `log` level
    console.debug(title, `${Math.round(Date.now() - start)}ms`);
  }
}

export async function logFunctionDuration<
  Fn extends (...args: unknown[]) => Promise<unknown>
>(title: string, fn: Fn): Promise<ReturnType<Fn>> {
  const start = Date.now();
  try {
    return (await fn()) as Awaited<ReturnType<Fn>>;
  } finally {
    // Prefer `debug` level; `console.time` has `log` level
    console.debug(title, `${Math.round(Date.now() - start)}ms`);
  }
}

export function isMac(): boolean {
  // https://stackoverflow.com/a/27862868/402560
  return globalThis.navigator?.platform.includes("Mac");
}

/** Tests a target string against a list of strings (full match) or regexes (can be mixed) */
export function matchesAnyPattern(
  target: string,
  patterns: Array<string | RegExp | ((x: string) => boolean)>
): boolean {
  return patterns.some((pattern) => {
    if (typeof pattern === "string") {
      return pattern === target;
    }

    if (typeof pattern === "function") {
      return pattern(target);
    }

    return pattern.test(target);
  });
}

// Enables highlighting/prettifying when used as html`<div>` or css`.a {}`
// https://prettier.io/blog/2020/08/24/2.1.0.html
function concatenateTemplateLiteralTag(
  strings: TemplateStringsArray,
  ...keys: string[]
): string {
  return strings
    .map((string, i) => string + (i < keys.length ? keys[i] : ""))
    .join("");
}

export const html = concatenateTemplateLiteralTag;
export const css = concatenateTemplateLiteralTag;

/**
 * Splits a value into a scope and id, based on scope starting with @ and id
 *  as everything following the first / character
 * @param value the full RegistryId
 */
export function getScopeAndId(
  value: RegistryId
): [string | undefined, string | undefined] {
  // Scope needs to start with @
  if (!value.startsWith("@")) {
    return [undefined, value];
  }

  // If the value starts with @ and doesn't have a slash, interpret it as a scope
  if (!value.includes("/")) {
    return [value, undefined];
  }

  const [scope, ...idParts] = split(value, "/");
  return [scope, idParts.join("/")];
}

const punctuation = [...".,;:?!"];

/**
 * Appends a period to a string as long as it doesn't end with one.
 * Considers quotes and parentheses and it always trims the trailing spaces.
 */
export function smartAppendPeriod(string: string): string {
  const trimmed = string.trimEnd();
  const [secondLastChar, lastChar] = trimmed.slice(-2);
  if (punctuation.includes(lastChar) || punctuation.includes(secondLastChar)) {
    // Already punctuated
    return trimmed;
  }

  // Else: No punctuation, find where to place it

  if (lastChar === '"' || lastChar === "'") {
    return trimmed.slice(0, -1) + "." + lastChar;
  }

  return trimmed + ".";
}

export function isValidUrl(
  value: string,
  { protocols = ["http:", "https:"] }: { protocols?: string[] } = {}
): boolean {
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol);
  } catch {
    return false;
  }
}

/**
 * Ignores calls made with the same arguments while the first call is pending
 * @example
 *   const memFetch = ignoreRepeatedCalls(fetch)
 *   await Promise([memFetch('/time'), memFetch('/time')])
 *   // => both will return the exact same Promise
 *   await memFetch('/time')
 *   // => no concurrent calls at this time, so another request made
 *
 * @see https://github.com/sindresorhus/promise-fun/issues/15
 */
export const memoizeUntilSettled: typeof pMemoize = (
  functionToMemoize,
  options
) =>
  pMemoize(functionToMemoize, {
    ...options,
    cache: false,
  });

export const foreverPendingPromise = new Promise(() => {});
