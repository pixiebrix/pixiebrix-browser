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
  type InitialValues,
  reduceExtensionPipeline,
} from "@/runtime/reducePipeline";
import { propertiesToSchema } from "@/validators/generic";
import {
  type Manifest,
  type Menus,
  type Permissions,
} from "webextension-polyfill";
import ArrayCompositeReader from "@/bricks/readers/ArrayCompositeReader";
import {
  StarterBrickABC,
  type StarterBrickConfig,
  type StarterBrickDefinition,
} from "@/starterBricks/types";
import { castArray, cloneDeep, compact, isEmpty, pick, uniq } from "lodash";
import { checkAvailable } from "@/bricks/available";
import {
  ensureContextMenu,
  uninstallContextMenu,
} from "@/background/messenger/api";
import { registerHandler } from "@/contentScript/contextMenus";
import { hasSpecificErrorCause } from "@/errors/errorHelpers";
import reportError from "@/telemetry/reportError";
import notify, {
  DEFAULT_ACTION_RESULTS,
  type MessageConfig,
  showNotification,
} from "@/utils/notify";
import reportEvent from "@/telemetry/reportEvent";
import { Events } from "@/telemetry/events";
import { selectEventData } from "@/telemetry/deployments";
import { selectExtensionContext } from "@/starterBricks/helpers";
import { type BrickConfig, type BrickPipeline } from "@/bricks/types";
import { isDeploymentActive } from "@/utils/deploymentUtils";
import apiVersionOptions from "@/runtime/apiVersionOptions";
import { selectAllBlocks } from "@/bricks/util";
import { mergeReaders } from "@/bricks/readers/readerUtils";
import { makeServiceContext } from "@/services/integrationUtils";
import { guessSelectedElement } from "@/utils/selectionController";
import {
  ContextMenuReader,
  contextMenuReaderShim,
} from "@/starterBricks/contextMenuReader";
import BackgroundLogger from "@/telemetry/BackgroundLogger";
import { BusinessError, CancelError } from "@/errors/businessErrors";
import { type Reader } from "@/types/bricks/readerTypes";
import { type Schema } from "@/types/schemaTypes";
import { type ResolvedModComponent } from "@/types/modComponentTypes";
import { type Brick } from "@/types/brickTypes";
import { type StarterBrick } from "@/types/starterBrickTypes";
import { type UUID } from "@/types/stringTypes";

export type ContextMenuTargetMode =
  // In `legacy` mode, the target was passed to the readers but the document is passed to reducePipeline
  "legacy" | "document" | "eventTarget";

export type ContextMenuConfig = {
  /**
   * The title of the context menu item.
   */
  title: string;

  /**
   * Action to perform on click.
   */
  action: BrickConfig | BrickPipeline;

  /**
   * (Experimental) message to show on success when running the extension
   * @since 1.7.27
   */
  onSuccess?: MessageConfig | boolean;
};

/**
 * The element the user right-clicked on to trigger the context menu
 */
let clickedElement: HTMLElement = null;
let selectionHandlerInstalled = false;

const BUTTON_SECONDARY = 2;

function setActiveElement(event: MouseEvent): void {
  // This method can't throw, otherwise I think it breaks event dispatching because we're passing
  // useCapture: true to the event listener
  clickedElement = null;
  if (event?.button === BUTTON_SECONDARY) {
    console.debug("Setting right-clicked element for contextMenu", {
      target: event.target,
    });
    clickedElement = event?.target as HTMLElement;
  }
}

function installMouseHandlerOnce(): void {
  if (!selectionHandlerInstalled) {
    selectionHandlerInstalled = true;
    // https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
    document.addEventListener("mousedown", setActiveElement, {
      // Handle it first in case a target beneath it cancels the event
      capture: true,
      // For performance, indicate we won't call preventDefault
      passive: true,
    });
  }
}

/**
 * See also: https://developer.chrome.com/extensions/contextMenus
 */
export abstract class ContextMenuStarterBrickABC extends StarterBrickABC<ContextMenuConfig> {
  public override get isSyncInstall() {
    return true;
  }

  abstract getBaseReader(): Promise<Reader>;

  abstract get targetMode(): ContextMenuTargetMode;

  abstract readonly documentUrlPatterns: Manifest.MatchPattern[];

  abstract readonly contexts: Menus.ContextType[];

  public get kind(): "contextMenu" {
    return "contextMenu";
  }

  inputSchema: Schema = propertiesToSchema(
    {
      title: {
        type: "string",
        description:
          "The text to display in the item. When the context is selection, use %s within the string to show the selected text.",
      },
      action: {
        oneOf: [
          { $ref: "https://app.pixiebrix.com/schemas/effect#" },
          {
            type: "array",
            items: { $ref: "https://app.pixiebrix.com/schemas/block#" },
          },
        ],
      },
    },
    ["title", "action"]
  );

  async getBricks(
    extension: ResolvedModComponent<ContextMenuConfig>
  ): Promise<Brick[]> {
    return selectAllBlocks(extension.config.action);
  }

  override uninstall({ global = false }: { global?: boolean }): void {
    // NOTE: don't uninstall the mouse/click handler because other context menus need it
    const extensions = this.modComponents.splice(0, this.modComponents.length);
    if (global) {
      for (const extension of extensions) {
        void uninstallContextMenu({ extensionId: extension.id });
      }
    }
  }

  /**
   * Remove the context menu items for the given extensions from all tabs/contexts.
   * @see uninstallContextMenu
   * @see preloadContextMenus
   */
  clearModComponentInterfaceAndEvents(extensionIds: UUID[]): void {
    // Context menus are registered with Chrome by document pattern via the background page. Therefore, it's impossible
    // to clear the UI menu item from a single tab. Calling `uninstallContextMenu` removes the tab from all menus.

    // Uninstalling context menus is the least-bad approach because it prevents duplicate menu item titles due to
    // re-activating a context menu (during re-activation, mod components get new extensionIds.)

    for (const extensionId of extensionIds) {
      void uninstallContextMenu({ extensionId });
    }
  }

  async install(): Promise<boolean> {
    // Always install the mouse handler in case a context menu is added later
    installMouseHandlerOnce();
    return this.isAvailable();
  }

  async runModComponents(): Promise<void> {
    await this.registerExtensions();
  }

  override async defaultReader(): Promise<Reader> {
    return new ArrayCompositeReader([
      await this.getBaseReader(),
      new ContextMenuReader(),
    ]);
  }

  override async previewReader(): Promise<Reader> {
    return new ArrayCompositeReader([
      await this.getBaseReader(),
      contextMenuReaderShim as unknown as Reader,
    ]);
  }

  async ensureMenu(
    extension: Pick<
      ResolvedModComponent<ContextMenuConfig>,
      "id" | "config" | "_deployment"
    >
  ): Promise<void> {
    const { title = "Untitled menu item" } = extension.config;

    // Check for null/undefined to preserve backward compatability
    if (!isDeploymentActive(extension)) {
      console.debug("Skipping ensureMenu for extension from paused deployment");
      return;
    }

    const patterns = compact(
      uniq([...this.documentUrlPatterns, ...(this.permissions?.origins ?? [])])
    );

    await ensureContextMenu({
      extensionId: extension.id,
      contexts: this.contexts ?? ["all"],
      title,
      documentUrlPatterns: patterns,
    });
  }

  private async registerExtensions(): Promise<void> {
    console.debug(
      "Registering",
      this.modComponents.length,
      "contextMenu starter bricks"
    );

    const results = await Promise.allSettled(
      this.modComponents.map(async (extension) => {
        try {
          await this.registerExtension(extension);
        } catch (error) {
          reportError(error, {
            context: {
              deploymentId: extension._deployment?.id,
              extensionPointId: extension.extensionPointId,
              extensionId: extension.id,
            },
          });
          throw error;
        }
      })
    );

    const numErrors = results.filter((x) => x.status === "rejected").length;
    if (numErrors > 0) {
      notify.error(
        `An error occurred adding ${numErrors} context menu item(s)`
      );
    }
  }

  decideReaderRoot(target: HTMLElement | Document): HTMLElement | Document {
    switch (this.targetMode) {
      case "legacy":
      case "eventTarget": {
        return target;
      }

      case "document": {
        return document;
      }

      default: {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- dynamic check for never
        throw new BusinessError(`Unknown targetMode: ${this.targetMode}`);
      }
    }
  }

  decidePipelineRoot(target: HTMLElement | Document): HTMLElement | Document {
    switch (this.targetMode) {
      case "eventTarget": {
        return target;
      }

      case "legacy":
      case "document": {
        return document;
      }

      default: {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- dynamic check for never
        throw new BusinessError(`Unknown targetMode: ${this.targetMode}`);
      }
    }
  }

  private async registerExtension(
    extension: ResolvedModComponent<ContextMenuConfig>
  ): Promise<void> {
    const { action: actionConfig, onSuccess = {} } = extension.config;

    await this.ensureMenu(extension);

    const extensionLogger = this.logger.childLogger(
      selectExtensionContext(extension)
    );

    console.debug(
      "Register context menu handler for: %s (%s)",
      extension.id,
      extension.label ?? "No Label",
      {
        extension,
      }
    );

    registerHandler(extension.id, async (clickData) => {
      reportEvent(Events.HANDLE_CONTEXT_MENU, selectEventData(extension));

      try {
        const reader = await this.getBaseReader();
        const serviceContext = await makeServiceContext(
          extension.integrationDependencies
        );

        const targetElement =
          clickedElement ?? guessSelectedElement() ?? document;

        const input = {
          ...(await reader.read(this.decideReaderRoot(targetElement))),
          // ClickData provides the data from schema defined above in ContextMenuReader
          ...clickData,
          // Add some additional data that people will generally want
          documentUrl: document.location.href,
        };

        const initialValues: InitialValues = {
          input,
          root: this.decidePipelineRoot(targetElement),
          serviceContext,
          optionsArgs: extension.optionsArgs,
        };

        await reduceExtensionPipeline(actionConfig, initialValues, {
          logger: extensionLogger,
          ...apiVersionOptions(extension.apiVersion),
        });

        if (onSuccess) {
          if (typeof onSuccess === "boolean" && onSuccess) {
            showNotification(DEFAULT_ACTION_RESULTS.success);
          } else {
            showNotification({
              ...DEFAULT_ACTION_RESULTS.success,
              ...pick(onSuccess, "message", "type"),
            });
          }
        }
      } catch (error) {
        if (hasSpecificErrorCause(error, CancelError)) {
          showNotification(DEFAULT_ACTION_RESULTS.cancel);
        } else {
          extensionLogger.error(error);
          showNotification(DEFAULT_ACTION_RESULTS.error);
        }
      }
    });
  }
}

export interface MenuDefaultOptions {
  title?: string;
  [key: string]: string | string[];
}

export interface MenuDefinition extends StarterBrickDefinition {
  documentUrlPatterns?: Manifest.MatchPattern[];
  contexts: Menus.ContextType[];
  targetMode: ContextMenuTargetMode;
  defaultOptions?: MenuDefaultOptions;
}

class RemoteContextMenuExtensionPoint extends ContextMenuStarterBrickABC {
  private readonly _definition: MenuDefinition;

  public readonly permissions: Permissions.Permissions;

  public readonly documentUrlPatterns: Manifest.MatchPattern[];

  public readonly contexts: Menus.ContextType[];

  public readonly rawConfig: StarterBrickConfig<MenuDefinition>;

  constructor(config: StarterBrickConfig<MenuDefinition>) {
    // `cloneDeep` to ensure we have an isolated copy (since proxies could get revoked)
    const cloned = cloneDeep(config);
    super(cloned.metadata, new BackgroundLogger());
    this._definition = cloned.definition;
    this.rawConfig = cloned;
    const { isAvailable, documentUrlPatterns, contexts } = cloned.definition;
    // If documentUrlPatterns not specified show everywhere
    this.documentUrlPatterns = castArray(documentUrlPatterns ?? ["*://*/*"]);
    this.contexts = castArray(contexts);
    this.permissions = {
      origins: isAvailable?.matchPatterns
        ? castArray(isAvailable.matchPatterns)
        : [],
    };
  }

  get targetMode(): ContextMenuTargetMode {
    // Default to "legacy" to match the legacy behavior
    return this._definition.targetMode ?? "legacy";
  }

  async isAvailable(): Promise<boolean> {
    if (
      !isEmpty(this._definition.isAvailable) &&
      (await checkAvailable(this._definition.isAvailable))
    ) {
      return true;
    }

    return checkAvailable({
      matchPatterns: this._definition.documentUrlPatterns,
    });
  }

  async getBaseReader() {
    return mergeReaders(this._definition.reader);
  }

  public override get defaultOptions(): {
    title: string;
    [key: string]: string | string[];
  } {
    return {
      title: "PixieBrix",
      ...this._definition.defaultOptions,
    };
  }
}

export function fromJS(
  config: StarterBrickConfig<MenuDefinition>
): StarterBrick {
  const { type } = config.definition;
  if (type !== "contextMenu") {
    throw new Error(`Expected type=contextMenu, got ${type}`);
  }

  return new RemoteContextMenuExtensionPoint(config);
}
