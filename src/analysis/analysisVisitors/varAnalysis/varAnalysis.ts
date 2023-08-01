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

import PipelineExpressionVisitor, {
  type VisitDocumentElementArgs,
} from "@/bricks/PipelineExpressionVisitor";
import {
  nestedPosition,
  type VisitBlockExtra,
  type VisitPipelineExtra,
} from "@/bricks/PipelineVisitor";
import { type BrickConfig, type BrickPosition } from "@/bricks/types";
import { type ModComponentFormState } from "@/pageEditor/starterBricks/formStateTypes";
import { getVariableKeyForSubPipeline } from "@/pageEditor/utils";
import { makeServiceContext } from "@/services/serviceUtils";
import { isEmpty } from "lodash";
import {
  type Analysis,
  type AnalysisAnnotation,
} from "@/analysis/analysisTypes";
import VarMap, { VarExistence } from "./varMap";
import { type TraceRecord } from "@/telemetry/trace";
import parseTemplateVariables from "./parseTemplateVariables";
import recipesRegistry from "@/modDefinitions/registry";
import blockRegistry, { type TypedBlockMap } from "@/bricks/registry";
import { type ListDocumentElement } from "@/components/documentBuilder/documentBuilderTypes";
import { ADAPTERS } from "@/pageEditor/starterBricks/adapter";
import { fromJS } from "@/starterBricks/factory";
import { type Schema } from "@/types/schemaTypes";
import { type Expression, type TemplateEngine } from "@/types/runtimeTypes";
import { AnnotationType } from "@/types/annotationTypes";
import {
  isDeferExpression,
  isExpression,
  isNunjucksExpression,
  isVarExpression,
} from "@/utils/expressionUtils";
import { type UnknownObject } from "@/types/objectTypes";
import { MOD_VARIABLE_REFERENCE } from "@/runtime/extendModVariableContext";
import { joinPathParts } from "@/utils/formUtils";

export const INVALID_VARIABLE_GENERIC_MESSAGE = "Invalid variable name";

export const NO_VARIABLE_PROVIDED_MESSAGE = "Variable is blank";

export const VARIABLE_SHOULD_START_WITH_AT_MESSAGE =
  "Variable name should start with @";

/**
 * Record to keep track of a variable context
 */
type VariableContext = {
  /**
   * Initial known variables.
   */
  readonly vars: VarMap;

  // Alternatively, we could keep track of block output variable so far in visitPipeline as a local variable. But that
  // would require overloading the base class's implementation of visitPipeline.
  // Alternatively, we could push new a context on to the context stack for each visited block. But that's a bit more
  // convoluted stack management.
  /**
   * Accumulator for new variables set by bricks in the pipeline so far.
   *
   * Used to accumulate variables for visitBlock because visitPipeline iterates over blocks in the pipeline (i.e., as
   * opposed to making recursive calls a la continuation passing style).
   */
  readonly blockOutputVars: VarMap;
};

export enum KnownSources {
  /**
   * Input provided by the starter brick.
   */
  INPUT = "input",
  /**
   * Mod options.
   */
  OPTIONS = "options",
  /**
   * Mod variables.
   */
  MOD = "mod",
  /**
   * Integration configuration.
   */
  SERVICE = "service",
  /**
   * Observed trace when running the bricks with the Page Editor open.
   */
  TRACE = "trace",
}

/**
 * Set availability of variables based on the integrations used by the ModComponentBase
 * @see makeServiceContext
 */
async function setServiceVars(
  extension: ModComponentFormState,
  contextVars: VarMap
): Promise<void> {
  // Loop through all the services so we can set the source each service variable properly
  for (const service of extension.services ?? []) {
    // eslint-disable-next-line no-await-in-loop
    const serviceContext = await makeServiceContext([service]);
    contextVars.setExistenceFromValues({
      source: `${KnownSources.SERVICE}:${service.id}`,
      values: serviceContext,
    });
  }
}

/**
 * Set the input variables from the ExtensionPoint definition (aka starter brick).
 */
async function setInputVars(
  extension: ModComponentFormState,
  contextVars: VarMap
): Promise<void> {
  const adapter = ADAPTERS.get(extension.extensionPoint.definition.type);
  const config = adapter.selectExtensionPointConfig(extension);

  const extensionPoint = fromJS(config);

  const reader = await extensionPoint.defaultReader();

  setVarsFromSchema({
    schema: reader?.outputSchema ?? {
      type: "object",
      properties: {},
      additionalProperties: true,
    },
    contextVars,
    source: KnownSources.INPUT,
    parentPath: ["@input"],
  });
}

type SetVarsFromSchemaArgs = {
  /**
   * The schema of the properties to use to set the variables.
   */
  schema: Schema;

  /**
   * The variable map to set the variables in.
   */
  contextVars: VarMap;

  /**
   * The source for the VarMap (e.g. "input:reader", "trace", or block path in the pipeline).
   */
  source: string;

  /**
   * The parent path of the properties in the schema.
   */
  parentPath: string[];

  /**
   * The existence to set the variables to. If not provided, the existence will be determined by the schema.
   */
  existenceOverride?: VarExistence;
};

/**
 * Helper method to set variables based on a JSON Schema.
 *
 * Examples:
 * - Blueprint input schema
 * - Brick output schema
 * - Integration configuration schema
 */
function setVarsFromSchema({
  schema = {},
  contextVars,
  source,
  parentPath,
  existenceOverride,
}: SetVarsFromSchemaArgs) {
  const { properties, required } = schema;

  if (properties == null) {
    contextVars.setExistence({
      source,
      path: parentPath,
      existence: existenceOverride ?? VarExistence.DEFINITELY,
      allowAnyChild: true,
    });
    return;
  }

  for (const [key, propertySchema] of Object.entries(properties)) {
    if (propertySchema === false) {
      continue;
    }

    if (propertySchema === true || propertySchema.type === "object") {
      const nodePath = [...parentPath, key];

      const existence =
        existenceOverride ?? required?.includes(key)
          ? VarExistence.DEFINITELY
          : VarExistence.MAYBE;

      // If additionalProperties, then we allow any child to simplify the validation logic, even
      // if it declares additional property constraints
      const allowAnyChild =
        propertySchema === true ||
        propertySchema.additionalProperties != null ||
        !isEmpty(propertySchema.additionalProperties);

      // Set existence for the current node
      contextVars.setExistence({
        source,
        path: nodePath,
        existence,
        isArray: false,
        allowAnyChild,
      });

      setVarsFromSchema({
        // If "true", pass a schema that allows any value
        schema: propertySchema === true ? {} : propertySchema,
        contextVars,
        source,
        parentPath: [...parentPath, key],
      });
    } else if (propertySchema.type === "array") {
      const existence =
        existenceOverride ?? required?.includes(key)
          ? VarExistence.DEFINITELY
          : VarExistence.MAYBE;

      const nodePath = [...parentPath, key];

      // If the items is an array, then we allow any child to simplify the validation logic
      const allowAnyChild =
        Array.isArray(propertySchema.items) ||
        !isEmpty(propertySchema.additionalItems);

      // Setting existence for the current node
      contextVars.setExistence({
        source,
        path: nodePath,
        existence,
        isArray: true,
        allowAnyChild,
      });

      if (allowAnyChild) {
        continue;
      }

      if (
        typeof propertySchema.items == "object" &&
        !Array.isArray(propertySchema.items) &&
        propertySchema.items.type === "object"
      ) {
        setVarsFromSchema({
          schema: propertySchema.items,
          contextVars,
          source,
          parentPath: nodePath,
        });
      }
    } else {
      contextVars.setExistence({
        source,
        path: [...parentPath, key],
        existence:
          existenceOverride ?? required?.includes(key)
            ? VarExistence.DEFINITELY
            : VarExistence.MAYBE,
      });
    }
  }
}

/**
 * Set the options variables from the blueprint option definitions.
 */
async function setOptionsVars(
  extension: ModComponentFormState,
  contextVars: VarMap
): Promise<void> {
  if (extension.recipe == null) {
    return;
  }

  const recipeId = extension.recipe.id;
  const recipe = await recipesRegistry.lookup(recipeId);
  const optionsSchema = recipe?.options?.schema;
  if (isEmpty(optionsSchema)) {
    return;
  }

  const source = `${KnownSources.OPTIONS}:${recipeId}`;
  const optionsOutputKey = "@options";

  setVarsFromSchema({
    schema: optionsSchema,
    contextVars,
    source,
    parentPath: [optionsOutputKey],
  });

  // Options currently only supports primitives, so don't need to recurse
  for (const optionName of Object.keys(extension.optionsArgs ?? {})) {
    contextVars.setExistence({
      source,
      path: [optionsOutputKey, optionName],
      existence: VarExistence.DEFINITELY,
    });
  }
}

async function setModVariables(
  modVariableNames: string[],
  modState: UnknownObject,
  contextVars: VarMap
): Promise<void> {
  setVarsFromSchema({
    schema: {
      type: "object",
      properties: Object.fromEntries(
        modVariableNames.map((name) => [name, {}])
      ),
      additionalProperties: true,
    },
    contextVars,
    source: KnownSources.MOD,
    parentPath: [MOD_VARIABLE_REFERENCE],
  });

  // In the future, we'll also calculate the likely schema based on the setMod bricks
  contextVars.setExistenceFromValues({
    source: KnownSources.MOD,
    values: modState,
    parentPath: MOD_VARIABLE_REFERENCE,
  });
}

class VarAnalysis extends PipelineExpressionVisitor implements Analysis {
  /**
   * The current trace, or empty if there is no trace.
   * @private
   */
  private readonly trace: TraceRecord[];

  /**
   * The current mod page state
   */
  private readonly modState: UnknownObject;

  /**
   * Statically-inferred mod variable names.
   * @since 1.7.36
   */
  private readonly modVariables: string[];

  /**
   * Accumulator for known variables at each block visited. Mapping from block path to VarMap.
   * @see VarMap
   * @private
   */
  private readonly knownVars = new Map<string, VarMap>();

  /**
   * The stack of nested variable contexts. The top of the stack (last element) is the current context.
   *
   * New stack frames are introduced for recursive calls:
   * - Child pipeline
   * - A brick configuration
   * - List Element in Document Builder (because it uses deferred expression and introduces a variable)
   *
   * @private
   */
  private readonly contextStack: VariableContext[] = [];

  /**
   * Annotation accumulator for warnings and errors
   * @protected
   */
  protected readonly annotations: AnalysisAnnotation[] = [];

  /**
   * Cache of block definitions to fetch definitions synchronously.
   * @private
   */
  private allBlocks: TypedBlockMap;

  get id() {
    return "var";
  }

  getAnnotations(): AnalysisAnnotation[] {
    return this.annotations;
  }

  getKnownVars() {
    return this.knownVars;
  }

  /**
   * Helper method to get the output schema for a block, given its configuration.
   *
   * In order of precedence:
   * - The dependent output schema
   * - The static output schema
   * - An empty schema
   *
   * @param blockConfig the block configuration
   * @private
   */
  private safeGetOutputSchema(blockConfig: BrickConfig): Schema {
    const block = this.allBlocks.get(blockConfig.id)?.block;

    if (!block) {
      return {};
    }

    // Be defensive if getOutputSchema errors due to nested variables, etc.
    try {
      return block.getOutputSchema(blockConfig);
    } catch {
      // NOP
    }

    return block.outputSchema ?? {};
  }

  /**
   * @param trace the trace for the latest run of the extension
   * @param modState the current mod page state
   * @param modVariables statically-inferred mod variable names
   * @see CollectNamesVisitor
   */
  constructor({
    trace = [],
    modState = {},
    modVariables = [],
  }: {
    trace?: TraceRecord[];
    modState?: UnknownObject;
    modVariables?: string[];
  } = {}) {
    super();
    this.trace = trace;
    this.modState = modState;
    this.modVariables = modVariables;
  }

  /**
   * Returns the current context variables. Do not modify the returned object directly, call `clone` first.
   * @private
   */
  private get currentContextVars(): VarMap {
    return this.contextStack.at(-1).vars ?? new VarMap();
  }

  override visitBrick(
    position: BrickPosition,
    blockConfig: BrickConfig,
    extra: VisitBlockExtra
  ) {
    // Create a new context frame with:
    // - The context provided by the parent pipeline
    // - Any blocks that appeared before this one in the pipeline
    // - Values seen from the trace
    const context = this.contextStack.at(-1);
    const blockKnownVars = context.vars.clone();
    blockKnownVars.addSourceMap(context.blockOutputVars);

    const traceRecord = this.trace.find(
      (x) =>
        x.blockInstanceId === blockConfig.instanceId &&
        x.templateContext != null
    );

    if (traceRecord?.templateContext != null) {
      blockKnownVars.setExistenceFromValues({
        source: KnownSources.TRACE,
        values: traceRecord.templateContext,
      });
    }

    this.knownVars.set(position.path, blockKnownVars);

    // Put all vars under `vars`. The recursive call doesn't care about whether the vars came from the context
    // parent pipeline or the preceding blocks.
    this.contextStack.push({
      vars: blockKnownVars,
      blockOutputVars: new VarMap(),
    });

    // Analyze the block
    super.visitBrick(position, blockConfig, extra);

    this.contextStack.pop();

    // Add the output vars to the context for the next block to see
    if (blockConfig.outputKey) {
      const currentBlockOutput = new VarMap();
      const outputVarName = `@${blockConfig.outputKey}`;
      const outputSchema = this.safeGetOutputSchema(blockConfig);

      setVarsFromSchema({
        schema: outputSchema,
        contextVars: currentBlockOutput,
        source: position.path,
        parentPath: [outputVarName],
        existenceOverride:
          blockConfig.if == null ? undefined : VarExistence.MAYBE,
      });

      context.blockOutputVars.addSourceMap(currentBlockOutput);
    }
  }

  override visitExpression(
    position: BrickPosition,
    expression: Expression<unknown>
  ): void {
    if (isVarExpression(expression)) {
      this.visitVarExpression(position, expression);
    } else if (isNunjucksExpression(expression)) {
      this.visitNunjucksExpression(position, expression);
    }
  }

  private visitVarExpression(
    position: BrickPosition,
    expression: Expression<string, "var">
  ) {
    const varName = expression.__value__;
    if (isEmpty(varName)) {
      return;
    }

    if (!this.currentContextVars.isVariableDefined(varName)) {
      this.pushNotFoundVariableAnnotation(position, varName, expression);
    }
  }

  private visitNunjucksExpression(
    position: BrickPosition,
    expression: Expression<string, "nunjucks">
  ) {
    let templateVariables: string[];
    try {
      templateVariables = parseTemplateVariables(expression.__value__);
    } catch {
      // Parsing errors usually happen because of malformed or incomplete template
      // Ignoring this for VarAnalysis
      return;
    }

    for (const varName of templateVariables) {
      if (!this.currentContextVars.isVariableDefined(varName)) {
        this.pushNotFoundVariableAnnotation(position, varName, expression);
      }
    }
  }

  private pushNotFoundVariableAnnotation(
    position: BrickPosition,
    varName: string,
    expression: Expression<string, TemplateEngine>
  ) {
    let message: string;
    if (varName === "@") {
      message = INVALID_VARIABLE_GENERIC_MESSAGE;
    } else if (varName.startsWith("@")) {
      message = `Variable "${varName}" might not be defined`;
    } else if (varName.trim() === "") {
      message = NO_VARIABLE_PROVIDED_MESSAGE;
    } else {
      message = VARIABLE_SHOULD_START_WITH_AT_MESSAGE;
    }

    if (
      this.annotations.some(
        (x) => x.message === message && x.position.path === position.path
      )
    ) {
      return;
    }

    this.annotations.push({
      position,
      message,
      analysisId: this.id,
      type: AnnotationType.Warning,
      detail: {
        expression,
      },
    });
  }

  override visitPipeline(
    position: BrickPosition,
    pipeline: BrickConfig[],
    extra: VisitPipelineExtra
  ) {
    // Get variable provided to child pipeline if applicable (e.g. for a for-each, try-except, block)
    const childPipelineKey =
      extra.parentNode && extra.pipelinePropName
        ? getVariableKeyForSubPipeline(extra.parentNode, extra.pipelinePropName)
        : null;

    const childPipelineVars = new VarMap();
    if (childPipelineKey) {
      childPipelineVars.setVariableExistence({
        // The source of the element key is the parent block
        source: extra.parentPosition.path,
        variableName: `@${childPipelineKey}`,
        existence: VarExistence.DEFINITELY,
        // XXX: in the future, base on the type of the variable provided
        allowAnyChild: true,
      });
    }

    // Construct new context with the variables provided to the child pipeline
    const pipelineVars = this.currentContextVars.clone();
    pipelineVars.addSourceMap(childPipelineVars);

    this.contextStack.push({
      vars: pipelineVars,
      blockOutputVars: new VarMap(),
    });

    super.visitPipeline(position, pipeline, extra);

    // Restoring the context of the parent pipeline
    this.contextStack.pop();
  }

  async run(extension: ModComponentFormState): Promise<void> {
    this.allBlocks = await blockRegistry.allTyped();

    // Order of the following calls will determine the order of the sources in the UI
    const contextVars = new VarMap();
    await setOptionsVars(extension, contextVars);
    await setModVariables(this.modVariables, this.modState, contextVars);
    await setServiceVars(extension, contextVars);
    await setInputVars(extension, contextVars);

    this.contextStack.push({
      vars: contextVars,
      blockOutputVars: new VarMap(),
    });

    this.visitRootPipeline(extension.extension.blockPipeline, {
      extensionPointType: extension.type,
    });
  }

  /**
   * Visit a Document Builder ListElement body.
   *
   * The ListElement body is a deferred expression that is evaluated with the elementKey available on each rendering
   * of an item.
   *
   * @param position the position of the document builder block
   * @param blockConfig the block config of the document builder block
   * @param element the ListElement within the document
   * @param pathInBlock the path of the ListElement within the document config
   */
  visitListElementBody({
    position,
    blockConfig,
    element,
    pathInBlock,
  }: VisitDocumentElementArgs) {
    const listElement = element as ListDocumentElement;

    // Variable name without the `@` prefix
    const variableKey = listElement.config.elementKey ?? "element";
    const listBodyExpression = listElement.config.element;

    // `element` of ListElement will always be a deferred expression when using Page Editor. But guard just in case.
    if (isDeferExpression(listBodyExpression)) {
      const deferredExpressionVars = new VarMap();

      if (typeof variableKey === "string") {
        deferredExpressionVars.setVariableExistence({
          source: position.path,
          variableName: `@${variableKey}`,
          existence: VarExistence.DEFINITELY,
          // XXX: type should be derived from the known array item type from the list
          allowAnyChild: true,
        });
      }

      const bodyKnownVars = this.currentContextVars.clone();
      bodyKnownVars.addSourceMap(deferredExpressionVars);

      this.knownVars.set(
        joinPathParts(
          position.path,
          pathInBlock,
          "config",
          "element",
          "__value__"
        ),
        bodyKnownVars
      );

      // Creating context frame for visiting the deferred expression
      this.contextStack.push({
        vars: bodyKnownVars,
        blockOutputVars: new VarMap(),
      });

      this.visitDocumentElement({
        position,
        blockConfig,
        element: (element as ListDocumentElement).config.element.__value__,
        pathInBlock: joinPathParts(
          pathInBlock,
          "config",
          "element",
          "__value__"
        ),
      });

      this.contextStack.pop();
    }
  }

  override visitDocument(
    position: BrickPosition,
    blockConfig: BrickConfig
  ): void {
    // Override because the base class extracts all pipelines directly. Instead, we need to visit the pipeline
    // in the context of their ancestor document builder elements (e.g., ListElement introduces a variable)
    for (const [index, element] of Object.entries(blockConfig.config.body)) {
      this.visitDocumentElement({
        position,
        blockConfig,
        element,
        pathInBlock: `config.body.${index}`,
      });
    }
  }

  /**
   * Visit an element within a document builder brick.
   * @see VisitDocumentElementArgs
   */
  override visitDocumentElement({
    position,
    blockConfig,
    element,
    pathInBlock,
  }: VisitDocumentElementArgs) {
    switch (element.type) {
      case "list": {
        for (const [prop, value] of Object.entries(element.config)) {
          // ListElement provides an elementKey to the deferred expression in its body
          if (prop === "element") {
            this.visitListElementBody({
              position,
              blockConfig,
              element,
              pathInBlock,
            });
          } else if (isExpression(value)) {
            this.visitExpression(
              nestedPosition(position, pathInBlock, "config", prop),
              value
            );
          }
        }

        break;
      }

      default: {
        super.visitDocumentElement({
          position,
          blockConfig,
          element,
          pathInBlock,
        });

        break;
      }
    }
  }
}

export default VarAnalysis;
