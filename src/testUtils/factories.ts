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

import { define, array, FactoryConfig, derive } from "cooky-cutter";
import { BlockConfig, BlockPipeline } from "@/blocks/types";
import {
  ApiVersion,
  IBlock,
  IExtension,
  InnerDefinitionRef,
  RegistryId,
  RenderedArgs,
  Schema,
  ServiceDependency,
  UserOptions,
  Metadata,
  RecipeMetadata,
  UUID,
  InnerDefinitions,
  SafeString,
} from "@/core";
import { TraceError, TraceRecord } from "@/telemetry/trace";
import {
  validateRegistryId,
  validateTimestamp,
  validateUUID,
} from "@/types/helpers";
import { Permissions } from "webextension-polyfill";
import { BaseExtensionState } from "@/pageEditor/extensionPoints/elementConfig";
import trigger from "@/pageEditor/extensionPoints/trigger";
import menuItem from "@/pageEditor/extensionPoints/menuItem";
import {
  ActionFormState,
  TriggerFormState,
} from "@/pageEditor/extensionPoints/formStateTypes";
import {
  RecipeDefinition,
  ExtensionPointConfig,
  SharingDefinition,
} from "@/types/definitions";
import {
  ExtensionPointDefinition as ExtensionPointConfigDefinition,
  ExtensionPointConfig as ExtensionPointDefinition,
  ExtensionPointType,
} from "@/extensionPoints/types";
import {
  Context as PageEditorTabContextType,
  FrameConnectionState,
} from "@/pageEditor/context";
import { TypedBlock, TypedBlockMap } from "@/blocks/registry";
import { Deployment } from "@/types/contract";
import { ButtonSelectionResult } from "@/contentScript/nativeEditor/types";
import getType from "@/runtime/getType";
import { FormState } from "@/pageEditor/pageEditorTypes";
import { freshIdentifier } from "@/utils";
import { DEFAULT_EXTENSION_POINT_VAR } from "@/pageEditor/extensionPoints/base";
import { padStart } from "lodash";

// UUID sequence generator that's predictable across runs. A couple characters can't be 0
// https://stackoverflow.com/a/19989922/402560
const uuidSequence = (n: number) =>
  validateUUID(`${padStart(String(n), 8, "0")}-0000-4000-A000-000000000000`);

export const recipeMetadataFactory = define<Metadata>({
  id: (n: number) => validateRegistryId(`test/recipe-${n}`),
  name: (n: number) => `Recipe ${n}`,
  description: "Recipe generated from factory",
  version: "1.0.0",
});

export const sharingDefinitionFactory = define<SharingDefinition>({
  public: false,
  organizations: () => [] as UUID[],
});

export const installedRecipeMetadataFactory = define<RecipeMetadata>({
  id: (n: number) => validateRegistryId(`test/recipe-${n}`),
  name: (n: number) => `Recipe ${n}`,
  description: "Recipe generated from factory",
  version: "1.0.0",
  updated_at: validateTimestamp("2021-10-07T12:52:16.189Z"),
  sharing: sharingDefinitionFactory,
});

const tabStateFactory = define<FrameConnectionState>({
  frameId: 0,
  hasPermissions: true,
  navSequence: uuidSequence,
  meta: null,
});

export const activeDevToolContextFactory = define<PageEditorTabContextType>({
  connecting: false,
  tabState: tabStateFactory,
});

export const extensionFactory = define<IExtension>({
  id: uuidSequence,
  apiVersion: "v2" as ApiVersion,
  extensionPointId: (n: number) =>
    validateRegistryId(`test/extension-point-${n}`),
  _recipe: undefined,
  _deployment: undefined,
  label: "Test label",
  services: [],
  config: (n: number) => ({
    apiVersion: "v2" as ApiVersion,
    kind: "component",
    metadata: recipeMetadataFactory({
      id: validateRegistryId(`test/component-${n}`),
      name: "Test config",
    }),
    inputSchema: {
      $schema: "https://json-schema.org/draft/2019-09/schema#",
      type: "object",
      properties: {},
      required: [] as string[],
    },
    pipeline: [
      {
        id: "@pixiebrix/browser/open-tab",
        config: {
          url: "http://www.amazon.com/s",
          params: {
            url: "search-alias={{{department}}}{{^department}}all{{/department}}&field-keywords={{{query}}}",
          },
        },
      },
    ],
  }),
  active: true,
});

export const TEST_BLOCK_ID = validateRegistryId("testing/block-id");

export const traceRecordFactory = define<TraceRecord>({
  timestamp: "2021-10-07T12:52:16.189Z",
  extensionId: uuidSequence,
  runId: uuidSequence,
  blockInstanceId: uuidSequence,
  blockId: TEST_BLOCK_ID,
  templateContext: {},
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- nominal typing
  renderedArgs: {} as RenderedArgs,
  renderError: null,
  blockConfig: {
    id: TEST_BLOCK_ID,
    config: {},
  },
});

export const traceErrorFactory = (config?: FactoryConfig<TraceError>) =>
  traceRecordFactory({
    error: {
      message: "Trace error for tests",
    },
    ...config,
  }) as TraceError;

export const blockFactory = define<IBlock>({
  id: (i: number) => validateRegistryId(`${TEST_BLOCK_ID}_${i}`),
  name: (i: number) => `${TEST_BLOCK_ID} ${i}`,
  inputSchema: null as Schema,
  defaultOptions: null,
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  permissions: {} as Permissions.Permissions,
  run: jest.fn(),
});

export const blocksMapFactory: (
  blockProps?: Partial<IBlock>
) => Promise<TypedBlockMap> = async (blockProps) => {
  const block1 = blockFactory(blockProps);
  const block2 = blockFactory(blockProps);

  const map = new Map<RegistryId, TypedBlock>();

  for (const block of [block1, block2]) {
    map.set(block.id, {
      block,
      // eslint-disable-next-line no-await-in-loop -- test code, no performance considerations
      type: await getType(block),
    });
  }

  return map;
};

export const blockConfigFactory = define<BlockConfig>({
  instanceId: uuidSequence,
  id: (i: number) => validateRegistryId(`${TEST_BLOCK_ID}_${i}`),
  config: () => ({}),
});

export const pipelineFactory: (
  blockConfigOverride?: FactoryConfig<BlockConfig>
) => BlockPipeline = (blockConfigProps) => {
  const blockConfig1 = blockConfigFactory(blockConfigProps);
  const blockConfig2 = blockConfigFactory(blockConfigProps);

  return [blockConfig1, blockConfig2] as BlockPipeline;
};

export const baseExtensionStateFactory = define<BaseExtensionState>({
  blockPipeline: () => pipelineFactory(),
});

export const extensionPointConfigFactory = define<ExtensionPointConfig>({
  id: "extensionPoint" as InnerDefinitionRef,
  label: (n: number) => `Test Extension ${n}`,
  services: {},
  config: () => ({
    caption: "Button",
    action: [] as BlockPipeline,
  }),
});

export const recipeDefinitionFactory = define<RecipeDefinition>({
  kind: "recipe",
  apiVersion: "v3",
  metadata: (n: number) =>
    recipeMetadataFactory({
      id: validateRegistryId(`test/blueprint-${n}`),
      name: `Blueprint ${n}`,
    }),
  updated_at: validateTimestamp("2021-10-07T12:52:16.189Z"),
  sharing: sharingDefinitionFactory,
  extensionPoints: array(extensionPointConfigFactory, 1),
});

export const extensionPointDefinitionFactory = define<ExtensionPointDefinition>(
  {
    kind: "extensionPoint",
    apiVersion: "v3",
    metadata: (n: number) =>
      recipeMetadataFactory({
        id: validateRegistryId(`test/extension-point-${n}`),
        name: `Extension Point ${n}`,
      }),
    definition(n: number) {
      const definition: ExtensionPointConfigDefinition = {
        type: "menuItem",
        isAvailable: {
          matchPatterns: [`https://www.mySite${n}.com/*`],
        },
        reader: validateRegistryId("@pixiebrix/document-context"),
      };
      return definition;
    },
  }
);

type ExternalExtensionPointParams = {
  extensionPointId?: RegistryId;
};

/**
 * Factory to create a RecipeDefinition that refers to a versioned extensionPoint
 * @param extensionPointId
 */
export const versionedExtensionPointRecipeFactory = ({
  extensionPointId,
}: ExternalExtensionPointParams = {}) =>
  define<RecipeDefinition>({
    kind: "recipe",
    apiVersion: "v3",
    metadata: (n: number) => ({
      id: validateRegistryId(`test/recipe-${n}`),
      name: `Recipe ${n}`,
      description: "Recipe generated from factory",
      version: "1.0.0",
    }),
    sharing: sharingDefinitionFactory,
    updated_at: validateTimestamp("2021-10-07T12:52:16.189Z"),
    definitions: undefined,
    options: undefined,
    extensionPoints: (n: number) => [
      {
        id: extensionPointId ?? validateRegistryId("test/extension-point"),
        label: `Test Extension for Recipe ${n}`,
        services: {},
        config: {
          caption: "Button",
          action: [] as BlockPipeline,
        },
      },
    ],
  });

/**
 * Factory to create a RecipeDefinition with a definitions section and resolved extensions
 * @param extensionCount
 */
export const versionedRecipeWithResolvedExtensions = (extensionCount = 1) => {
  const extensionPoints: ExtensionPointConfig[] = [];
  for (let i = 0; i < extensionCount; i++) {
    // Don't use array(factory, count) here, because it will keep incrementing
    // the modifier number across multiple test runs and cause non-deterministic
    // test execution behavior.
    const extensionPoint = extensionPointConfigFactory();
    const ids = extensionPoints.map((x) => x.id);
    const id = freshIdentifier(DEFAULT_EXTENSION_POINT_VAR as SafeString, ids);
    extensionPoints.push({
      ...extensionPoint,
      id: id as InnerDefinitionRef,
    });
  }

  const definitions: InnerDefinitions = {};

  for (const extensionPoint of extensionPoints) {
    definitions[extensionPoint.id] = {
      kind: "extensionPoint",
      definition: extensionPointDefinitionFactory().definition,
    };
  }

  return define<RecipeDefinition>({
    kind: "recipe",
    apiVersion: "v3",
    metadata: (n: number) => ({
      id: validateRegistryId(`test/recipe-${n}`),
      name: `Recipe ${n}`,
      description: "Recipe generated from factory",
      version: "1.0.0",
    }),
    sharing: sharingDefinitionFactory,
    updated_at: validateTimestamp("2021-10-07T12:52:16.189Z"),
    definitions,
    options: undefined,
    extensionPoints,
  });
};

type InnerExtensionPointParams = {
  extensionPointRef?: InnerDefinitionRef;
};

/**
 * Factory to create a factory that creates a RecipeDefinition that refers to a versioned extensionPoint
 * @param extensionPointId
 */
export const innerExtensionPointRecipeFactory = ({
  extensionPointRef = "extensionPoint" as InnerDefinitionRef,
}: InnerExtensionPointParams = {}) =>
  define<RecipeDefinition>({
    kind: "recipe",
    apiVersion: "v3",
    metadata: recipeMetadataFactory,
    sharing: { public: false, organizations: [] },
    updated_at: validateTimestamp("2021-10-07T12:52:16.189Z"),
    definitions: {
      [extensionPointRef]: {
        kind: "extensionPoint",
        definition: {
          type: "menuItem",
          isAvailable: {
            matchPatterns: ["https://*/*"],
            urlPatterns: [],
            selectors: [],
          },
          reader: validateRegistryId("@pixiebrix/document-context"),
        },
      },
    },
    options: undefined,
    extensionPoints: () => [
      extensionPointConfigFactory({ id: extensionPointRef }),
    ],
  });

/**
 * A default Recipe factory
 */
export const recipeFactory = innerExtensionPointRecipeFactory();

const deploymentPackageFactory = define<Deployment["package"]>({
  id: uuidSequence,
  name: derive<Deployment["package"], string>(
    ({ config }) => config.metadata.name,
    "config"
  ),
  version: derive<Deployment["package"], string>(
    ({ config }) => config.metadata.version,
    "config"
  ),
  package_id: derive<Deployment["package"], RegistryId>(
    ({ config }) => config.metadata.id,
    "config"
  ),
  config: recipeDefinitionFactory as any,
});

export const deploymentFactory = define<Deployment>({
  id: uuidSequence,
  name: (n: number) => `Deployment ${n}`,
  created_at: validateTimestamp("2021-10-07T12:52:16.189Z"),
  updated_at: validateTimestamp("2021-10-07T12:52:16.189Z"),
  active: true,
  bindings: () => [] as Deployment["bindings"],
  services: () => [] as Deployment["services"],
  package_version: derive<Deployment, string>(
    ({ package: deploymentPackage }) => deploymentPackage.version,
    "package"
  ),
  package: deploymentPackageFactory,
});

const internalFormStateFactory = define<FormState>({
  apiVersion: "v3" as ApiVersion,
  uuid: uuidSequence,
  installed: true,
  optionsArgs: null as UserOptions,
  services: [] as ServiceDependency[],
  recipe: null,

  type: "panel" as ExtensionPointType,
  label: (i: number) => `Element ${i}`,
  extension: baseExtensionStateFactory,
  extensionPoint: extensionPointDefinitionFactory,
} as any);

export const formStateFactory = (
  override?: FactoryConfig<FormState>,
  blockConfigOverride?: FactoryConfig<BlockConfig>
) => {
  if (blockConfigOverride) {
    return internalFormStateFactory({
      ...override,
      extension: baseExtensionStateFactory({
        blockPipeline: pipelineFactory(blockConfigOverride),
      }),
    } as any);
  }

  return internalFormStateFactory(override);
};

export const triggerFormStateFactory = (
  override: FactoryConfig<TriggerFormState>,
  blockConfigOverride?: FactoryConfig<BlockConfig>
) => {
  const defaultTriggerProps = trigger.fromNativeElement(
    "https://test.com",
    recipeMetadataFactory({
      id: (n: number) => validateRegistryId(`test/extension-point-${n}`),
      name: (n: number) => `Extension Point ${n}`,
    }),
    null
  );

  return formStateFactory(
    {
      ...defaultTriggerProps,
      ...override,
    } as any,
    blockConfigOverride
  ) as TriggerFormState;
};

export const menuItemFormStateFactory = (
  override: FactoryConfig<ActionFormState>,
  blockConfigOverride?: FactoryConfig<BlockConfig>
) => {
  const defaultTriggerProps = menuItem.fromNativeElement(
    "https://test.com",
    recipeMetadataFactory({
      id: (n: number) => validateRegistryId(`test/extension-point-${n}`),
      name: (n: number) => `Extension Point ${n}`,
    }),
    {
      item: {
        caption: "Caption for test",
      },
    } as ButtonSelectionResult
  );

  return formStateFactory(
    {
      ...defaultTriggerProps,
      ...override,
    } as any,
    blockConfigOverride
  ) as ActionFormState;
};
