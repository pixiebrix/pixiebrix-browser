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
  ApiVersion,
  Config,
  EmptyConfig,
  IExtension,
  InnerDefinitionRef,
  Metadata,
  RegistryId,
  SafeString,
  UUID,
} from "@/core";
import { castArray, cloneDeep, omit } from "lodash";
import {
  assertExtensionPointConfig,
  ExtensionPointConfig,
  ExtensionPointDefinition,
} from "@/extensionPoints/types";
import { find as findBrick } from "@/registry/localRegistry";
import React from "react";
import { createSitePattern } from "@/permissions/patterns";
import {
  BaseFormState,
  SingleLayerReaderConfig,
} from "@/devTools/editor/extensionPoints/elementConfig";
import { Except } from "type-fest";
import { uuidv4, validateRegistryId } from "@/types/helpers";
import {
  BlockPipeline,
  NormalizedAvailability,
  ReaderConfig,
} from "@/blocks/types";
import { deepPickBy, freshIdentifier } from "@/utils";

export interface WizardStep {
  step: string;
  Component: React.FunctionComponent<{
    eventKey: string;
    editable?: Set<string>;
    available?: boolean;
  }>;
  extraProps?: Record<string, unknown>;
}

/**
 * Brick definition API controlling how the PixieBrix runtime interprets brick configurations
 * @see ApiVersion
 */
export const PAGE_EDITOR_DEFAULT_BRICK_API_VERSION: ApiVersion = "v2";

/**
 * Default definition entry for the inner definition of the extensionPoint for the extension
 */
const DEFAULT_EXTENSION_POINT_VAR = "extensionPoint";

const INNER_SCOPE = "@internal";

export function isInnerExtensionPoint(
  id: RegistryId | InnerDefinitionRef
): boolean {
  return id.startsWith(INNER_SCOPE + "/");
}

export function makeIsAvailable(url: string): NormalizedAvailability {
  return {
    matchPatterns: [createSitePattern(url)],
    selectors: [],
  };
}

/**
 * Enrich a BlockPipeline with instanceIds for use in tracing.
 */
export function withInstanceIds(blocks: BlockPipeline): BlockPipeline {
  return blocks.map((blockConfig) => ({
    ...blockConfig,
    instanceId: uuidv4(),
  }));
}

/**
 * Remove the automatically generated tracing ids.
 */
export function excludeInstanceIds<T extends Config>(
  config: T,
  prop: keyof T
): T {
  return {
    ...config,
    // eslint-disable-next-line security/detect-object-injection -- prop checked in signature
    [prop]: (config[prop] as BlockPipeline).map((blockConfig) =>
      omit(blockConfig, "instanceId")
    ),
  };
}

export function makeInitialBaseState(
  uuid: UUID = uuidv4()
): Except<BaseFormState, "type" | "label" | "extensionPoint"> {
  return {
    uuid,
    apiVersion: PAGE_EDITOR_DEFAULT_BRICK_API_VERSION,
    services: [],
    extension: {},
  };
}

/**
 * Create metadata for a temporary extension point definition. When the extension point is saved, it will be moved
 * into the definitions section of the extension.
 */
export function internalExtensionPointMetaFactory(): Metadata {
  return {
    id: validateRegistryId(`${INNER_SCOPE}/${uuidv4()}`),
    name: "Temporary extension point",
  };
}

/**
 * Map availability from extension point configuration to state for the page editor.
 */
export function selectIsAvailable(
  extensionPoint: ExtensionPointConfig
): NormalizedAvailability {
  assertExtensionPointConfig(extensionPoint);

  const { isAvailable } = extensionPoint.definition;
  const matchPatterns = castArray(isAvailable.matchPatterns ?? []);
  const selectors = castArray(isAvailable.selectors ?? []);

  return {
    matchPatterns,
    selectors,
  };
}

export function hasInnerExtensionPoint(extension: IExtension): boolean {
  const hasInner = extension.extensionPointId in (extension.definitions ?? {});

  if (!hasInner && isInnerExtensionPoint(extension.extensionPointId)) {
    console.warn(
      "Extension is missing inner definition for %s",
      extension.extensionPointId,
      { extension }
    );
  }

  return hasInner;
}

export async function lookupExtensionPoint<
  TDefinition extends ExtensionPointDefinition,
  TConfig extends EmptyConfig,
  TType extends string
>(
  config: IExtension<TConfig>,
  type: TType
): Promise<
  ExtensionPointConfig<TDefinition> & { definition: { type: TType } }
> {
  if (!config) {
    throw new Error("config is required");
  }

  if (hasInnerExtensionPoint(config)) {
    const definition = config.definitions[config.extensionPointId];
    console.debug(
      "Converting extension definition to temporary extension point",
      definition
    );
    const innerExtensionPoint = ({
      apiVersion: PAGE_EDITOR_DEFAULT_BRICK_API_VERSION,
      kind: "extensionPoint",
      metadata: internalExtensionPointMetaFactory(),
      ...definition,
    } as unknown) as ExtensionPointConfig<TDefinition> & {
      definition: { type: TType };
    };

    assertExtensionPointConfig(innerExtensionPoint);
    return innerExtensionPoint;
  }

  const brick = await findBrick(config.extensionPointId);
  if (!brick) {
    throw new Error(
      `Cannot find extension point definition: ${config.extensionPointId}`
    );
  }

  const extensionPoint = (brick.config as unknown) as ExtensionPointConfig<TDefinition>;
  if (extensionPoint.definition.type !== type) {
    throw new Error("Expected panel extension point type");
  }

  return extensionPoint as ExtensionPointConfig<TDefinition> & {
    definition: { type: TType };
  };
}

export function baseSelectExtensionPoint(
  formState: BaseFormState
): Except<ExtensionPointConfig, "definition"> {
  const { metadata } = formState.extensionPoint;

  return {
    apiVersion: formState.apiVersion,
    kind: "extensionPoint",
    metadata: {
      id: metadata.id,
      // The server requires the version to save the brick, even though it's not marked as required
      // in the front-end schemas
      version: metadata.version ?? "1.0.0",
      name: metadata.name,
      // The server requires the description to save the brick, even though it's not marked as required
      // in the front-end schemas
      description: metadata.description ?? "Created using the Page Editor",
    },
  };
}

export function extensionWithInnerDefinitions(
  extension: IExtension,
  extensionPointDefinition: ExtensionPointDefinition
): IExtension {
  if (isInnerExtensionPoint(extension.extensionPointId)) {
    const extensionPointId = freshIdentifier(
      DEFAULT_EXTENSION_POINT_VAR as SafeString,
      [...Object.keys(extension.definitions ?? {})]
    );

    const result = cloneDeep(extension);
    result.definitions = {
      ...result.definitions,
      [extensionPointId]: {
        kind: "extensionPoint",
        definition: extensionPointDefinition,
      },
    };

    // XXX: we need to fix the type of IExtension.extensionPointId to support variable names
    result.extensionPointId = extensionPointId as RegistryId;

    return result;
  }

  return extension;
}

/**
 * Remove object entries undefined and empty-string values.
 *
 * - Formik/React need real blank values in order to control `input` tag components.
 * - PixieBrix does not want those because it treats an empty string as "", not null/undefined
 */
// eslint-disable-next-line @typescript-eslint/ban-types -- support interfaces that don't have index types
export function removeEmptyValues<T extends object>(obj: T): T {
  // Technically the return type is Partial<T> (with recursive partials). However, we'll trust that the PageEditor
  // requires the user to set values that actually need to be set. (They'll also get caught by input validation in
  // when the bricks are run.
  return deepPickBy(
    obj,
    (x: unknown) => typeof x !== "undefined" && x !== ""
  ) as T;
}

/**
 * Return a composite reader to automatically include in new extensions created with the Page Editor.
 */
export function getImplicitReader(): SingleLayerReaderConfig {
  return [validateRegistryId("@pixiebrix/document-metadata")];
}

/**
 * Hack to use SingleLayerReaderConfig to prevent TypeScript reporting problems with infinite type instantiation
 */
export function readerHack(reader: ReaderConfig): SingleLayerReaderConfig {
  return reader as SingleLayerReaderConfig;
}
