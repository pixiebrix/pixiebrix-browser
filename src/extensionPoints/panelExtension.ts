import { v4 as uuidv4 } from "uuid";
import { ExtensionPoint } from "@/types";
import { faColumns, IconDefinition } from "@fortawesome/free-solid-svg-icons";
import Mustache from "mustache";
import { errorBoundary } from "@/blocks/renderers/common";
import { checkAvailable } from "@/blocks/available";
import castArray from "lodash/castArray";
import {
  reducePipeline,
  mergeReaders,
  blockList,
  BlockConfig,
  BlockPipeline,
  makeServiceContext,
} from "@/blocks/combinators";
import { boolean } from "@/utils";
import { awaitElementOnce, acquireElement } from "@/extensionPoints/helpers";
import {
  IBlock,
  IExtension,
  IExtensionPoint,
  IPermissions,
  IReader,
  ReaderOutput,
  Schema,
  ServiceLocator,
} from "@/core";
import {
  ExtensionPointDefinition,
  ExtensionPointConfig,
} from "@/extensionPoints/types";
import { reportError } from "@/telemetry/rollbar";

interface PanelConfig {
  heading?: string;
  body: BlockConfig | BlockPipeline;
  collapsible?: boolean;
  shadowDOM?: boolean;
}

/**
 * Extension point that adds a panel to a web page.
 */
export class PanelExtensionPoint extends ExtensionPoint<PanelConfig> {
  public get defaultOptions(): { heading: string } {
    return { heading: "Custom Panel" };
  }
  protected template?: string;

  protected $container: JQuery;
  private readonly collapsedExtensions: { [key: string]: boolean };

  constructor(
    id: string,
    name: string,
    description?: string,
    icon: IconDefinition = faColumns
  ) {
    super(id, name, description, icon);
    this.$container = null;
    this.collapsedExtensions = {};
  }

  inputSchema: Schema = {
    $schema: "https://json-schema.org/draft/2019-09/schema",
    type: "object",
    properties: {
      heading: {
        type: "string",
        description: "The panel heading",
      },
      body: {
        $ref: "https://app.pixiebrix.com/schemas/renderer#",
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
    },
    required: ["heading", "body"],
  };

  getBlocks(extension: IExtension<PanelConfig>): IBlock[] {
    return blockList(extension.config.body);
  }

  defaultReader(): IReader {
    throw new Error("PanelExtensionPoint.defaultReader not implemented");
  }

  getTemplate() {
    if (this.template) return this.template;
    throw new Error("PanelExtensionPoint.getTemplate not implemented");
  }

  getContainerSelector(): string | string[] {
    throw new Error("PanelExtensionPoint.getContainerSelector not implemented");
  }

  async isAvailable(): Promise<boolean> {
    throw new Error("PanelExtensionPoint.isAvailable not implemented");
  }

  async install() {
    if (!(await this.isAvailable())) {
      console.debug(
        `Skipping panel extension ${this.id} because it's not available for the page`
      );
      return false;
    }

    const selector = this.getContainerSelector();

    console.debug(`Awaiting panel container for ${this.id}: ${selector}`);

    this.$container = await awaitElementOnce(selector);

    return acquireElement(this.$container, this.id, () => {
      console.debug(`Container removed from DOM for ${this.id}: ${selector}`);
      this.$container = undefined;
    });
  }

  addPanel($panel: JQuery): void {
    this.$container.append($panel);
  }

  private async runExtension(
    readerContext: ReaderOutput,
    locator: ServiceLocator,
    extension: IExtension<PanelConfig>
  ) {
    const bodyUUID = uuidv4();

    const {
      body,
      heading,
      collapsible: rawCollapsible = false,
      shadowDOM: rawShadowDOM = true,
    } = extension.config;

    const collapsible = boolean(rawCollapsible);
    const shadowDOM = boolean(rawShadowDOM);

    const serviceContext = await makeServiceContext(
      extension.services,
      locator
    );
    const extensionContext = { ...readerContext, ...serviceContext };

    const $panel = $(
      Mustache.render(this.getTemplate(), {
        heading: Mustache.render(heading, extensionContext),
        // render a placeholder body that we'll fill in async
        body: `<div id="${bodyUUID}"></div>`,
        bodyUUID,
      })
    );

    $panel.attr("data-pixiebrix-uuid", extension.id);

    const $existingPanel = this.$container.find(
      `[data-pixiebrix-uuid="${extension.id}"]`
    );

    if ($existingPanel.length) {
      console.debug(`Replacing existing panel for ${extension.id}`);
      $existingPanel.replaceWith($panel);
    } else {
      console.debug(`Adding new panel for ${extension.id}`);
      this.addPanel($panel);
    }

    // update the body content with the new args
    const $bodyContainer = this.$container.find(`#${bodyUUID}`);

    let isBodyInstalled = false;

    const installBody = () => {
      if (!isBodyInstalled) {
        isBodyInstalled = true;
        const rendererPromise = reducePipeline(body, readerContext, {
          validate: true,
          serviceArgs: serviceContext,
        }) as Promise<string>;
        errorBoundary(rendererPromise).then((bodyHTML) => {
          if (boolean(shadowDOM)) {
            const shadowRoot = $bodyContainer
              .get(0)
              .attachShadow({ mode: "closed" });
            shadowRoot.innerHTML = bodyHTML;
          } else {
            $bodyContainer.html(bodyHTML);
          }
        });
      }
    };

    if (collapsible) {
      const startExpanded = !this.collapsedExtensions[extension.id];

      if (startExpanded) {
        installBody();
      }

      $bodyContainer.addClass(["collapse"]);
      const $toggle = $panel.find('[data-toggle="collapse"]');

      $bodyContainer.toggleClass("show", startExpanded);
      $toggle.attr("aria-expanded", String(startExpanded));
      $toggle.toggleClass("active", startExpanded);

      $toggle.click(() => {
        $bodyContainer.toggleClass("show");
        const showing = $bodyContainer.hasClass("show");
        $toggle.attr("aria-expanded", String(showing));
        $toggle.toggleClass("active", showing);
        this.collapsedExtensions[extension.id] = !showing;
        if (showing) {
          installBody();
        }
      });
    } else {
      installBody();
    }
  }

  async run(locator: ServiceLocator) {
    if (!this.$container || !this.extensions.length) {
      return;
    }

    const reader = this.defaultReader();
    const readerContext = await reader.read();

    if (readerContext == null) {
      throw new Error("Reader returned null/undefined");
    }

    const errors = [];

    for (const extension of this.extensions) {
      try {
        await this.runExtension(readerContext, locator, extension);
      } catch (ex) {
        reportError(ex);
        errors.push(ex);
      }
    }

    if (errors.length) {
      $.notify(`An error occurred adding ${errors.length} panels(s)`, {
        className: "error",
      });
    }
  }
}

interface PanelDefaultOptions {
  heading?: string;
  [key: string]: string;
}

interface PanelDefinition extends ExtensionPointDefinition {
  template: string;
  position?: "append" | "prepend";
  containerSelector: string;
  defaultOptions: PanelDefaultOptions;
}

class HydratedPanelExtensionPoint extends PanelExtensionPoint {
  private readonly _definition: PanelDefinition;

  public get defaultOptions(): {
    heading: string;
    [key: string]: string;
  } {
    const { heading, ...defaults } = this._definition.defaultOptions ?? {};
    return {
      heading: heading ?? super.defaultOptions.heading,
      ...defaults,
    };
  }

  constructor(config: ExtensionPointConfig<PanelDefinition>) {
    const { id, name, description } = config.metadata;
    super(id, name, description);
    this._definition = config.definition;
  }

  defaultReader(): IReader {
    return mergeReaders(this._definition.reader);
  }

  addPanel($panel: JQuery): void {
    const { position = "append" } = this._definition;
    switch (position) {
      case "prepend":
      case "append": {
        this.$container[position]($panel);
        break;
      }
      default: {
        throw new Error(`Unexpected position ${position}`);
      }
    }
  }

  getPermissions(): IPermissions {
    const { isAvailable } = this._definition;
    return {
      permissions: ["tabs", "webNavigation"],
      origins: castArray(isAvailable.matchPatterns),
    };
  }

  getContainerSelector(): string {
    return this._definition.containerSelector;
  }

  getTemplate(): string {
    return this._definition.template;
  }

  async isAvailable(): Promise<boolean> {
    const { isAvailable } = this._definition;
    return await checkAvailable(isAvailable);
  }
}

export function fromJS(
  config: ExtensionPointConfig<PanelDefinition>
): IExtensionPoint {
  const { type } = config.definition;
  if (type !== "panel") {
    throw new Error(`Expected type=panel, got ${type}`);
  }
  return new HydratedPanelExtensionPoint(config);
}
