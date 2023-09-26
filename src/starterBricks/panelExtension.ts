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

import { uuidv4 } from "@/types/helpers";
import Mustache from "mustache";
import { errorBoundary } from "@/bricks/renderers/common";
import { checkAvailable } from "@/bricks/available";
import { castArray, cloneDeep } from "lodash";
import {
  type InitialValues,
  reduceExtensionPipeline,
} from "@/runtime/reducePipeline";
import {
  acquireElement,
  awaitElementOnce,
  onNodeRemoved,
  selectExtensionContext,
} from "@/starterBricks/helpers";
import { type Metadata } from "@/types/registryTypes";
import { type Logger } from "@/types/loggerTypes";
import {
  StarterBrickABC,
  type StarterBrickConfig,
  type StarterBrickDefinition,
} from "@/starterBricks/types";
import { propertiesToSchema } from "@/validators/generic";
import { render } from "@/starterBricks/dom";
import { type Permissions } from "webextension-polyfill";
import reportEvent from "@/telemetry/reportEvent";
import { Events } from "@/telemetry/events";
import notify from "@/utils/notify";
import getSvgIcon from "@/icons/getSvgIcon";
import { type BrickConfig, type BrickPipeline } from "@/bricks/types";
import { selectEventData } from "@/telemetry/deployments";
import apiVersionOptions from "@/runtime/apiVersionOptions";
import { selectAllBlocks } from "@/bricks/util";
import { makeServiceContext } from "@/services/integrationUtils";
import { mergeReaders } from "@/bricks/readers/readerUtils";
import { PIXIEBRIX_DATA_ATTR } from "@/domConstants";
import BackgroundLogger from "@/telemetry/BackgroundLogger";
import { type IconConfig } from "@/types/iconTypes";
import { type UUID } from "@/types/stringTypes";
import { type Schema } from "@/types/schemaTypes";
import { type ResolvedModComponent } from "@/types/modComponentTypes";
import { type Brick } from "@/types/brickTypes";
import { type Reader } from "@/types/bricks/readerTypes";
import { type JsonObject } from "type-fest";
import { type RendererOutput, type RunArgs } from "@/types/runtimeTypes";
import { type StarterBrick } from "@/types/starterBrickTypes";
import { boolean } from "@/utils/typeUtils";

export type PanelConfig = {
  heading?: string;
  body: BrickConfig | BrickPipeline;
  icon?: IconConfig;
  collapsible?: boolean;
  shadowDOM?: boolean;
};

const RENDER_LOOP_THRESHOLD = 25;
const RENDER_LOOP_WINDOW_MS = 500;

/**
 * Prevent panel render from entering an infinite loop
 */
function detectLoop(timestamps: Date[]): void {
  const current = new Date();

  const renders = timestamps.filter(
    (x) => Math.abs(current.getTime() - x.getTime()) < RENDER_LOOP_WINDOW_MS
  );

  if (renders.length > RENDER_LOOP_THRESHOLD) {
    const diffs = timestamps.map((x) =>
      Math.abs(current.getTime() - x.getTime())
    );
    console.error("Panel is stuck in a render loop", {
      diffs,
    });
    throw new Error("Panel is stuck in a render loop");
  }
}

/**
 * Extension point that adds a panel to a web page.
 */
export abstract class PanelStarterBrickABC extends StarterBrickABC<PanelConfig> {
  protected $container: JQuery;

  private readonly collapsedExtensions: Map<UUID, boolean>;

  private readonly cancelPending: Set<() => void>;

  private uninstalled = false;

  private readonly cancelRemovalMonitor: Map<string, () => void>;

  private readonly renderTimestamps: Map<string, Date[]>;

  public override get defaultOptions(): { heading: string } {
    return { heading: "Custom Panel" };
  }

  protected constructor(metadata: Metadata, logger: Logger) {
    super(metadata, logger);
    this.$container = null;
    this.collapsedExtensions = new Map();
    this.cancelPending = new Set();
    this.cancelRemovalMonitor = new Map();
    this.renderTimestamps = new Map();
  }

  inputSchema: Schema = propertiesToSchema(
    {
      heading: {
        type: "string",
        description: "The panel heading",
      },
      body: {
        oneOf: [
          { $ref: "https://app.pixiebrix.com/schemas/renderer#" },
          {
            type: "array",
            items: { $ref: "https://app.pixiebrix.com/schemas/block#" },
          },
        ],
      },
      shadowDOM: {
        type: "boolean",
        description: "Whether or not to use a shadow DOM for the body",
        default: true,
      },
      collapsible: {
        type: "boolean",
        description: "Whether or not the body is collapsible",
        default: false,
      },
      icon: { $ref: "https://app.pixiebrix.com/schemas/icon#" },
    },
    ["heading", "body"]
  );

  public get kind(): "panel" {
    return "panel";
  }

  async getBricks(
    extension: ResolvedModComponent<PanelConfig>
  ): Promise<Brick[]> {
    return selectAllBlocks(extension.config.body);
  }

  clearModComponentInterfaceAndEvents(): void {
    // FIXME: implement this to avoid unnecessary firing
    console.warn("removeExtensions not implemented for panel extensionPoint");
  }

  override async defaultReader(): Promise<Reader> {
    throw new Error("PanelExtensionPoint.defaultReader not implemented");
  }

  abstract getTemplate(): string;

  abstract getContainerSelector(): string | string[];

  abstract override isAvailable(): Promise<boolean>;

  override uninstall(): void {
    this.uninstalled = true;

    for (const extension of this.modComponents) {
      const $item = this.$container.find(
        `[${PIXIEBRIX_DATA_ATTR}="${extension.id}"]`
      );
      if ($item.length === 0) {
        console.debug(`Panel for ${extension.id} was not in the menu`);
      }

      $item.remove();
    }

    this.$container = null;

    for (const cancel of this.cancelPending) {
      cancel();
    }

    this.cancelPending.clear();
  }

  async install(): Promise<boolean> {
    if (!(await this.isAvailable())) {
      console.debug(
        `Skipping panel extension because it's not available for the page: ${this.id}`
      );
      return false;
    }

    const selector = this.getContainerSelector();

    console.debug(
      `Awaiting panel container for ${this.id}: ${JSON.stringify(selector)}`
    );

    const [containerPromise, cancelInstall] = awaitElementOnce(selector);
    this.cancelPending.add(cancelInstall);

    this.$container = (await containerPromise) as JQuery;

    if (this.$container.length === 0) {
      return false;
    }

    if (this.$container.length > 1) {
      console.error(
        `Multiple containers found for selector: ${JSON.stringify(selector)}`
      );
      this.logger.error(`Multiple containers found: ${this.$container.length}`);
      return false;
    }

    const container = this.$container.get(0);

    const acquired = acquireElement(container, this.id);

    if (acquired) {
      this.cancelPending.add(
        onNodeRemoved(container, () => {
          console.debug(
            `Container removed from DOM for ${this.id}: ${JSON.stringify(
              selector
            )}`
          );
          this.$container = undefined;
        })
      );
    }

    return acquired;
  }

  addPanel($panel: JQuery): void {
    this.$container.append($panel);
  }

  private async runExtension(
    readerOutput: JsonObject,
    extension: ResolvedModComponent<PanelConfig>
  ) {
    if (this.uninstalled) {
      throw new Error("panelExtension has already been destroyed");
    }

    // Initialize render timestamps for extension
    let renderTimestamps = this.renderTimestamps.get(extension.id);
    if (renderTimestamps == null) {
      this.renderTimestamps.set(extension.id, []);
      renderTimestamps = this.renderTimestamps.get(extension.id);
    }

    renderTimestamps.push(new Date());
    const cnt = renderTimestamps.length;

    console.debug(`Run panelExtension: ${extension.id}`);

    detectLoop(renderTimestamps);

    const bodyUUID = uuidv4();
    const extensionLogger = this.logger.childLogger(
      selectExtensionContext(extension)
    );

    const {
      body,
      icon,
      heading,
      collapsible: rawCollapsible = false,
      shadowDOM: rawShadowDOM = true,
    } = extension.config;

    const collapsible = boolean(rawCollapsible);
    const shadowDOM = boolean(rawShadowDOM);

    // Start collapsed
    if (collapsible && cnt === 1) {
      this.collapsedExtensions.set(extension.id, true);
    }

    const serviceContext = await makeServiceContext(
      extension.integrationDependencies
    );
    const extensionContext = { ...readerOutput, ...serviceContext };

    const $panel = $(
      Mustache.render(this.getTemplate(), {
        heading: Mustache.render(heading, extensionContext),
        // Render a placeholder body that we'll fill in async
        body: `<div id="${bodyUUID}"></div>`,
        icon: icon ? await getSvgIcon(icon) : null,
        bodyUUID,
      })
    );

    $panel.attr(PIXIEBRIX_DATA_ATTR, extension.id);

    const $existingPanel = this.$container.find(
      `[${PIXIEBRIX_DATA_ATTR}="${extension.id}"]`
    );

    // Clean up removal monitor, otherwise it will be re-triggered during replaceWith
    const cancelCurrent = this.cancelRemovalMonitor.get(extension.id);
    if (cancelCurrent) {
      console.debug(`Cancelling removal monitor for ${extension.id}`);
      cancelCurrent();
      this.cancelRemovalMonitor.delete(extension.id);
      this.cancelPending.delete(cancelCurrent);
    } else {
      console.debug(`No current removal monitor for ${extension.id}`);
    }

    if ($existingPanel.length > 0) {
      if (this.cancelRemovalMonitor.get(extension.id) != null) {
        throw new Error("Removal monitor still attached for panel");
      }

      console.debug(`Replacing existing panel for ${extension.id}`);
      $existingPanel.replaceWith($panel);
    } else {
      console.debug(`Adding new panel for ${extension.id}`);
      this.addPanel($panel);
      reportEvent(Events.PANEL_ADD, selectEventData(extension));
    }

    // FIXME: required sites that remove the panel, e.g., Pipedrive. Currently causing infinite loop on Salesforce
    //  when switching between cases
    // const cancelNodeRemoved = onNodeRemoved($panel.get(0), () => {
    //   console.debug(
    //     `Panel for ${extension.id} was removed from the DOM (render: ${cnt}); re-running`
    //   );
    //   this.run([extension.id]);
    // });
    // this.cancelRemovalMonitor.set(extension.id, cancelNodeRemoved);
    // this.cancelPending.add(cancelNodeRemoved);

    // update the body content with the new args
    const $bodyContainers = this.$container.find(`#${bodyUUID}`);

    if ($bodyContainers.length > 1) {
      throw new Error("Found multiple body containers");
    }

    const bodyContainer = $bodyContainers.get(0);

    let isBodyInstalled = false;

    const installBody = async () => {
      if (!isBodyInstalled) {
        isBodyInstalled = true;

        const initialValues: InitialValues = {
          input: readerOutput,
          optionsArgs: extension.optionsArgs,
          serviceContext,
          root: document,
        };

        const rendererPromise = reduceExtensionPipeline(body, initialValues, {
          logger: extensionLogger,
          ...apiVersionOptions(extension.apiVersion),
        }) as Promise<RendererOutput>;

        try {
          const bodyOrComponent = await errorBoundary(
            rendererPromise,
            extensionLogger
          );
          render(bodyContainer, bodyOrComponent, {
            shadowDOM,
          });
          extensionLogger.debug("Successfully installed panel");
        } catch (error) {
          extensionLogger.error(error);
        }
      }
    };

    if (collapsible) {
      const startExpanded = !this.collapsedExtensions.get(extension.id);

      $bodyContainers.addClass(["collapse"]);
      const $toggle = $panel.find('[data-toggle="collapse"]');

      $bodyContainers.toggleClass("show", startExpanded);
      $toggle.attr("aria-expanded", String(startExpanded));
      $toggle.toggleClass("active", startExpanded);

      $toggle.on("click", async () => {
        $bodyContainers.toggleClass("show");
        const showing = $bodyContainers.hasClass("show");
        $toggle.attr("aria-expanded", String(showing));
        $toggle.toggleClass("active", showing);
        this.collapsedExtensions.set(extension.id, !showing);
        if (showing) {
          console.debug(
            `Installing body for collapsible panel: ${extension.id}`
          );
          await installBody();
        }
      });

      if (startExpanded) {
        await installBody();
      }
    } else {
      console.debug(
        `Installing body for non-collapsible panel: ${extension.id}`
      );
      await installBody();
    }
  }

  async runModComponents({ extensionIds = null }: RunArgs): Promise<void> {
    if (!this.$container || this.modComponents.length === 0) {
      return;
    }

    const reader = await this.defaultReader();

    const readerContext = await reader.read(document);
    if (readerContext == null) {
      throw new Error("Reader returned null/undefined");
    }

    const errors: unknown[] = [];

    for (const extension of this.modComponents) {
      if (extensionIds != null && !extensionIds.includes(extension.id)) {
        continue;
      }

      try {
        // Running in loop to ensure consistent placement. OK because `installBody` in runExtension is runs asynchronously
        // eslint-disable-next-line no-await-in-loop
        await this.runExtension(readerContext, extension);
      } catch (error) {
        errors.push(error);
        this.logger
          .childLogger({
            deploymentId: extension._deployment?.id,
            extensionId: extension.id,
          })
          .error(error);
      }
    }

    if (errors.length > 0) {
      notify.error(`An error occurred adding ${errors.length} panels(s)`);
    }
  }
}

interface PanelDefaultOptions {
  heading?: string;
  [key: string]: string | boolean | number;
}

type PanelPosition =
  | "append"
  | "prepend"
  | {
      // Element to insert the panel item before, selector is relative to the container
      sibling: string | null;
    };

export interface PanelDefinition extends StarterBrickDefinition {
  template: string;
  position?: PanelPosition;
  containerSelector: string;
  defaultOptions?: PanelDefaultOptions;
}

class RemotePanelExtensionPoint extends PanelStarterBrickABC {
  private readonly _definition: PanelDefinition;

  public readonly permissions: Permissions.Permissions;

  public readonly rawConfig: StarterBrickConfig<PanelDefinition>;

  constructor(config: StarterBrickConfig<PanelDefinition>) {
    // `cloneDeep` to ensure we have an isolated copy (since proxies could get revoked)
    const cloned = cloneDeep(config);
    super(cloned.metadata, new BackgroundLogger());
    this._definition = cloned.definition;
    this.rawConfig = cloned;
    const { isAvailable } = cloned.definition;
    this.permissions = {
      permissions: ["tabs", "webNavigation"],
      origins: castArray(isAvailable.matchPatterns),
    };
  }

  public override get defaultOptions(): {
    heading: string;
    [key: string]: string;
  } {
    const { heading, ...defaults } = this._definition.defaultOptions ?? {};
    return {
      heading: heading ?? super.defaultOptions.heading,
      ...defaults,
    };
  }

  override async defaultReader(): Promise<Reader> {
    return mergeReaders(this._definition.reader);
  }

  override addPanel($panel: JQuery): void {
    const { position = "append" } = this._definition;

    if (typeof position !== "string") {
      throw new TypeError("Expected string for panel position");
    }

    switch (position) {
      case "prepend":
      case "append": {
        // Safe because we're casing the method name
        // eslint-disable-next-line security/detect-object-injection
        this.$container[position]($panel);
        break;
      }

      default: {
        // Type is `never` due to checks above
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`Unexpected position: ${position}`);
      }
    }
  }

  override getContainerSelector(): string {
    return this._definition.containerSelector;
  }

  override getTemplate(): string {
    return this._definition.template;
  }

  override async isAvailable(): Promise<boolean> {
    const { isAvailable } = this._definition;
    return checkAvailable(isAvailable);
  }
}

export function fromJS(
  config: StarterBrickConfig<PanelDefinition>
): StarterBrick {
  const { type } = config.definition;
  if (type !== "panel") {
    throw new Error(`Expected type=panel, got ${type}`);
  }

  return new RemotePanelExtensionPoint(config);
}
