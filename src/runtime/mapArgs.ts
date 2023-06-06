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

import {
  type AsyncTemplateRenderer,
  type TemplateRenderer,
  engineRenderer,
  type RendererOptions,
} from "@/runtime/renderers";
import { isPlainObject, mapValues, pickBy } from "lodash";
import { getPropByPath, isSimplePath } from "./pathHelpers";
import {
  type Expression,
  type ExpressionType,
  type TemplateEngine,
} from "@/types/runtimeTypes";
import { asyncMapValues } from "@/utils";
import Mustache from "mustache";
import { type BlockPipeline } from "@/blocks/types";
import { type UnknownObject } from "@/types/objectTypes";

const templateTypes: TemplateEngine[] = [
  "mustache",
  "nunjucks",
  "handlebars",
  "var",
];

const expressionTypes: ExpressionType[] = [
  ...templateTypes,
  "pipeline",
  "defer",
];

export type Args = string | UnknownObject | UnknownObject[];

/**
 * Returns true if value represents an explicit expression
 * @see isTemplateExpression
 */
export function isExpression(value: unknown): value is Expression<unknown> {
  if (
    isPlainObject(value) &&
    typeof value === "object" &&
    "__type__" in value
  ) {
    return expressionTypes.includes((value as Expression).__type__);
  }

  return false;
}

export type PipelineExpression = Expression<BlockPipeline, "pipeline">;

/**
 * A PipelineExpression with an attached lexical environment. Internal type used by the runtime
 * @since 1.7.29
 */
export type PipelineClosureExpression = PipelineExpression & {
  __env__: UnknownObject;
};

export function isPipelineExpression(
  value: unknown
): value is PipelineExpression {
  return isExpression(value) && value.__type__ === "pipeline";
}

export function isPipelineClosureExpression(
  value: unknown
): value is PipelineClosureExpression {
  return isPipelineExpression(value) && "__env__" in value;
}

export type DeferExpression<TValue = UnknownObject> = Expression<
  TValue,
  "defer"
>;

export function isDeferExpression<TValue = UnknownObject>(
  value: unknown
): value is DeferExpression<TValue> {
  return isExpression(value) && value.__type__ === "defer";
}

/**
 * Returns true if value represents an explicit template engine expression
 * @see isExpression
 */
export function isTemplateExpression(
  value: unknown
): value is Expression<string, TemplateEngine> {
  return (
    isExpression(value) &&
    templateTypes.includes((value as Expression).__type__ as TemplateEngine)
  );
}

/**
 * Returns true if value represents a variable expression
 * @see isExpression
 */
export function isVarExpression(
  value: unknown
): value is Expression<string, "var"> {
  return isExpression(value) && (value as Expression).__type__ === "var";
}

/**
 * Returns true if value represents a nunjucks expression
 * @see isExpression
 */
export function isNunjucksExpression(
  value: unknown
): value is Expression<string, "nunjucks"> {
  return isExpression(value) && (value as Expression).__type__ === "nunjucks";
}

/**
 * Recursively render values
 * @since 1.5.0
 */
export async function renderExplicit(
  config: Args,
  ctxt: UnknownObject,
  options: RendererOptions
): Promise<unknown> {
  if (isTemplateExpression(config)) {
    // This check is added to prevent exceptions when rendering a faulty template
    // see https://github.com/pixiebrix/pixiebrix-extension/issues/2413
    if (config.__value__ == null) {
      return isVarExpression(config) ? null : "";
    }

    const render = engineRenderer(config.__type__, options);
    return render(config.__value__, ctxt);
  }

  if (isPipelineExpression(config) || isDeferExpression(config)) {
    // Pipeline and defer are not rendered. The brick that consumes the configuration is responsible for rendering
    // the value. We keep the expression type so that the brick has enough information to determine the expression type
    return config;
  }

  // Array.isArray must come before the object check because arrays are objects
  if (Array.isArray(config)) {
    return Promise.all(
      config.map(async (x) => renderExplicit(x, ctxt, options))
    );
  }

  if (isPlainObject(config)) {
    const renderedEntries = await asyncMapValues(config, async (subConfig) =>
      renderExplicit(subConfig as UnknownObject, ctxt, options)
    );

    return pickBy(renderedEntries, (x) => x != null);
  }

  // Is a primitive value, e.g., string, number, etc.
  return config;
}

/**
 * Recursively apply a template renderer to a configuration.
 */
export function renderMustache(config: string, ctxt: UnknownObject): string;
// eslint-disable-next-line @typescript-eslint/ban-types -- we don't want to require index signature
export function renderMustache<T extends object>(
  config: T,
  ctxt: UnknownObject
): T;
export function renderMustache(
  config: UnknownObject[],
  ctxt: UnknownObject
): UnknownObject[];
export function renderMustache(config: Args, ctxt: UnknownObject): unknown {
  if (Array.isArray(config)) {
    return config.map((x) => renderMustache(x, ctxt));
  }

  if (isPlainObject(config) && typeof config === "object") {
    return pickBy(
      mapValues(config, (subConfig) => renderMustache(subConfig as any, ctxt)),
      (x) => x != null
    ) as any;
  }

  if (typeof config !== "string") {
    throw new TypeError("Expected string");
  }

  return Mustache.render(config, ctxt);
}

export async function renderImplicit(
  config: Args,
  ctxt: UnknownObject,
  render: AsyncTemplateRenderer | TemplateRenderer
): Promise<unknown> {
  if (Array.isArray(config)) {
    return Promise.all(
      config.map(async (x) => renderImplicit(x, ctxt, render))
    );
  }

  if (isPlainObject(config) && typeof config === "object") {
    return pickBy(
      await asyncMapValues(config, async (subConfig) =>
        renderImplicit(subConfig as UnknownObject, ctxt, render)
      ),
      (x) => x != null
    );
  }

  if (typeof config === "string") {
    if (isSimplePath(config, ctxt)) {
      const prop = getPropByPath(ctxt, config);
      if (prop && typeof prop === "object" && "__service" in prop) {
        // If we're returning the root service context, return the service itself for use with proxyService
        return prop.__service;
      }

      return prop;
    }

    return render(config, ctxt);
  }

  return config;
}

// We're intentionally forcing all properties to be provided to eliminate mistakes where a call site is not updated
// when we introduce a new option
export type MapOptions = {
  /**
   * Render method for v1-v2 implicit runtime behavior
   */
  implicitRender: AsyncTemplateRenderer | null;

  /**
   * True to auto-escape the values.
   */
  autoescape: boolean | null;
};

/**
 * Recursively apply a template renderer to a configuration.
 */
export async function mapArgs(
  config: Args,
  ctxt: UnknownObject,
  // We're intentionally forcing callers to provide options here because the options should always depend on the
  // `apiVersion` of the block/extensionPoint/blueprint that mapArgs is being called from
  { implicitRender, autoescape }: MapOptions
): Promise<unknown> {
  if (implicitRender) {
    return renderImplicit(config, ctxt, implicitRender);
  }

  return renderExplicit(config, ctxt, { autoescape });
}
