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
  apiVersionOptions,
  blockList,
  makeServiceContext,
  mergeReaders,
  reducePipeline,
} from "@/blocks/combinators";
import { ExtensionPoint, Reader } from "@/types";
import {
  IBlock,
  IExtensionPoint,
  IReader,
  ReaderOutput,
  ResolvedExtension,
  Schema,
} from "@/core";
import { propertiesToSchema } from "@/validators/generic";
import { Menus, Permissions } from "webextension-polyfill-ts";
import ArrayCompositeReader from "@/blocks/readers/ArrayCompositeReader";
import {
  ExtensionPointConfig,
  ExtensionPointDefinition,
} from "@/extensionPoints/types";
import { castArray, uniq, compact, cloneDeep, isEmpty } from "lodash";
import { checkAvailable } from "@/blocks/available";
import {
  ensureContextMenu,
  uninstallContextMenu,
} from "@/background/messenger/api";
import { registerHandler } from "@/contentScript/contextMenus";
import { reportError } from "@/telemetry/logging";
import { Manifest } from "webextension-polyfill-ts/lib/manifest";
import { getCommonAncestor } from "@/nativeEditor/infer";
import { notifyError } from "@/contentScript/notify";
import { reportEvent } from "@/telemetry/events";
import { selectEventData } from "@/telemetry/deployments";
import { selectExtensionContext } from "@/extensionPoints/helpers";
import { getErrorMessage, isErrorObject } from "@/errors";
import { BlockConfig, BlockPipeline } from "@/blocks/types";

export type ContextMenuConfig = {
  title: string;
  action: BlockConfig | BlockPipeline;
};

let clickedElement: HTMLElement = null;
let selectionHandlerInstalled = false;

const BUTTON_SECONDARY = 2;

function setActiveElement(event: MouseEvent): void {
  // This method can't throw, otherwise I think it breaks event dispatching because we're passing
  // useCapture: true to the event listener
  clickedElement = null;
  if (event?.button === BUTTON_SECONDARY) {
    clickedElement = event?.target as HTMLElement;
  }
}

function guessSelectedElement(): HTMLElement | null {
  const selection = document.getSelection();
  if (selection?.rangeCount) {
    const start = selection.getRangeAt(0).startContainer.parentNode;
    const end = selection.getRangeAt(selection.rangeCount - 1).endContainer
      .parentNode;
    const node = getCommonAncestor(start, end);
    if (node instanceof HTMLElement) {
      return node;
    }

    return null;
  }

  return null;
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

export class ContextMenuReader extends Reader {
  constructor() {
    super(
      "@pixiebrix/context-menu-data",
      "Context menu reader",
      "Data from a context menu event"
    );
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async read(): Promise<ReaderOutput> {
    // The actual field is set by the extension point, not the reader, because it's made available
    // by the browser API in the menu handler
    throw new Error("Not implemented");
  }

  outputSchema: Schema = {
    type: "object",
    properties: {
      mediaType: {
        type: "string",
        description:
          "One of 'image', 'video', or 'audio' if the context menu was activated on one of these types of elements.",
        enum: ["image", "video", "audio"],
      },
      linkText: {
        type: "string",
        description: "If the element is a link, the text of that link.",
      },
      linkUrl: {
        type: "string",
        description: "If the element is a link, the URL it points to.",
        format: "uri",
      },
      srcUrl: {
        type: "string",
        description: "Will be present for elements with a 'src' URL.",
        format: "uri",
      },
      selectionText: {
        type: "string",
        description: "The text for the context selection, if any.",
      },
      documentUrl: {
        type: "string",
        description: "The URL of the page where the context menu was activated",
        format: "uri",
      },
    },
  };
}

/**
 * See also: https://developer.chrome.com/extensions/contextMenus
 */
export abstract class ContextMenuExtensionPoint extends ExtensionPoint<ContextMenuConfig> {
  protected constructor(
    id: string,
    name: string,
    description?: string,
    icon = "faMousePointer"
  ) {
    super(id, name, description, icon);
  }

  public get syncInstall() {
    return true;
  }

  abstract getBaseReader(): Promise<IReader>;

  abstract readonly documentUrlPatterns: Manifest.MatchPattern[];

  abstract readonly contexts: Menus.ContextType[];

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

  async getBlocks(
    extension: ResolvedExtension<ContextMenuConfig>
  ): Promise<IBlock[]> {
    return blockList(extension.config.action);
  }

  uninstall({ global = false }: { global?: boolean }): void {
    // Don't uninstall the mouse handler because other context menus need it
    const extensions = this.extensions.splice(0, this.extensions.length);
    if (global) {
      for (const extension of extensions) {
        void uninstallContextMenu({ extensionId: extension.id }).catch(
          reportError
        );
      }
    }
  }

  removeExtensions(): void {
    // Don't need to do any cleanup since context menu registration is handled globally
  }

  async install(): Promise<boolean> {
    // Always install the mouse handler in case a context menu is added later
    installMouseHandlerOnce();
    const available = await this.isAvailable();
    await this.registerExtensions();
    return available;
  }

  async defaultReader(): Promise<IReader> {
    return new ArrayCompositeReader([
      await this.getBaseReader(),
      new ContextMenuReader(),
    ]);
  }

  async ensureMenu(
    extension: Pick<ResolvedExtension<ContextMenuConfig>, "id" | "config">
  ): Promise<void> {
    const { title } = extension.config;

    const patterns = compact(
      uniq([...this.documentUrlPatterns, ...(this.permissions?.origins ?? [])])
    );

    await ensureContextMenu({
      extensionId: extension.id,
      contexts: this.contexts,
      title,
      documentUrlPatterns: patterns,
    });
  }

  private async registerExtensions(): Promise<void> {
    const results = await Promise.allSettled(
      this.extensions.map(async (extension) => {
        try {
          await this.registerExtension(extension);
        } catch (error: unknown) {
          reportError(error, {
            deploymentId: extension._deployment?.id,
            extensionPointId: extension.extensionPointId,
            extensionId: extension.id,
          });
          throw error;
        }
      })
    );

    const numErrors = results.filter((x) => x.status === "rejected").length;
    if (numErrors > 0) {
      notifyError(`An error occurred adding ${numErrors} context menu item(s)`);
    }
  }

  private async registerExtension(
    extension: ResolvedExtension<ContextMenuConfig>
  ): Promise<void> {
    const { action: actionConfig } = extension.config;

    await this.ensureMenu(extension);

    const extensionLogger = this.logger.childLogger(
      selectExtensionContext(extension)
    );

    registerHandler(extension.id, async (clickData) => {
      reportEvent("HandleContextMenu", selectEventData(extension));

      try {
        const reader = await this.getBaseReader();
        const serviceContext = await makeServiceContext(extension.services);

        const targetElement =
          clickedElement ?? guessSelectedElement() ?? document;

        const ctxt = {
          ...(await reader.read(targetElement)),
          // ClickData provides the data from schema defined above in ContextMenuReader
          ...clickData,
          // Add some additional data that people will generally want
          documentUrl: document.location.href,
        };

        await reducePipeline(actionConfig, ctxt, extensionLogger, document, {
          validate: true,
          serviceArgs: serviceContext,
          optionsArgs: extension.optionsArgs,
          ...apiVersionOptions(extension.apiVersion),
        });
      } catch (error: unknown) {
        if (isErrorObject(error)) {
          reportError(error);
          extensionLogger.error(error);
        } else {
          // XXX: If it's not an error object, it won't have an error message
          extensionLogger.warn(getErrorMessage(error));
        }

        // XXX: Errors that are passed to `reportError` should not be re-thrown
        throw error;
      }
    });
  }

  async run(): Promise<void> {
    if (this.extensions.length === 0) {
      console.debug(
        `contextMenu extension point ${this.id} has no installed extension`
      );
      return;
    }

    await this.registerExtensions();
  }
}

export interface MenuDefaultOptions {
  title?: string;
  [key: string]: string | string[];
}

export interface MenuDefinition extends ExtensionPointDefinition {
  documentUrlPatterns?: Manifest.MatchPattern[];
  contexts: Menus.ContextType[];
  defaultOptions?: MenuDefaultOptions;
}

class RemoteContextMenuExtensionPoint extends ContextMenuExtensionPoint {
  private readonly _definition: MenuDefinition;

  public readonly permissions: Permissions.Permissions;

  public readonly documentUrlPatterns: Manifest.MatchPattern[];

  public readonly contexts: Menus.ContextType[];

  public readonly rawConfig: ExtensionPointConfig<MenuDefinition>;

  constructor(config: ExtensionPointConfig<MenuDefinition>) {
    // `cloneDeep` to ensure we have an isolated copy (since proxies could get revoked)
    const cloned = cloneDeep(config);
    const { id, name, description, icon } = config.metadata;
    super(id, name, description, icon);
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

  public get defaultOptions(): {
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
  config: ExtensionPointConfig<MenuDefinition>
): IExtensionPoint {
  const { type } = config.definition;
  if (type !== "contextMenu") {
    throw new Error(`Expected type=contextMenu, got ${type}`);
  }

  return new RemoteContextMenuExtensionPoint(config);
}
