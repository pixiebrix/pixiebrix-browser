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
import { checkAvailable } from "@/blocks/available";
import { castArray, cloneDeep, debounce, once, pick } from "lodash";
import {
  type InitialValues,
  reduceExtensionPipeline,
  reducePipeline,
} from "@/runtime/reducePipeline";
import { hasSpecificErrorCause } from "@/errors/errorHelpers";
import {
  acquireElement,
  awaitElementOnce,
  onNodeRemoved,
  selectExtensionContext,
} from "@/extensionPoints/helpers";
import {
  StarterBrickABC,
  type StarterBrickConfig,
  type StarterBrickDefinition,
} from "@/extensionPoints/types";
import { type Logger } from "@/types/loggerTypes";
import { type Metadata } from "@/types/registryTypes";
import { propertiesToSchema } from "@/validators/generic";
import { type Permissions } from "webextension-polyfill";
import { reportEvent } from "@/telemetry/events";
import notify, {
  DEFAULT_ACTION_RESULTS,
  type MessageConfig,
  showNotification,
} from "@/utils/notify";
import { getNavigationId } from "@/contentScript/context";
import getSvgIcon from "@/icons/getSvgIcon";
import { selectEventData } from "@/telemetry/deployments";
import { type BrickConfig, type BrickPipeline } from "@/blocks/types";
import apiVersionOptions, {
  DEFAULT_IMPLICIT_TEMPLATE_ENGINE,
} from "@/runtime/apiVersionOptions";
import { engineRenderer } from "@/runtime/renderers";
import { mapArgs } from "@/runtime/mapArgs";
import { selectAllBlocks } from "@/blocks/util";
import { makeServiceContext } from "@/services/serviceUtils";
import { mergeReaders } from "@/blocks/readers/readerUtils";
import { $safeFind } from "@/helpers";
import sanitize from "@/utils/sanitize";
import { EXTENSION_POINT_DATA_ATTR } from "@/common";
import BackgroundLogger from "@/telemetry/BackgroundLogger";
import reportError from "@/telemetry/reportError";
import pluralize from "@/utils/pluralize";
import {
  BusinessError,
  CancelError,
  MultipleElementsFoundError,
  NoElementsFoundError,
} from "@/errors/businessErrors";
import { PromiseCancelled } from "@/errors/genericErrors";
import { rejectOnCancelled } from "@/errors/rejectOnCancelled";
import { type IconConfig } from "@/types/iconTypes";
import { type Schema } from "@/types/schemaTypes";
import { type ResolvedExtension } from "@/types/extensionTypes";
import { type Brick } from "@/types/brickTypes";
import { type JsonObject } from "type-fest";
import {
  type RunArgs,
  RunReason,
  type SelectorRoot,
} from "@/types/runtimeTypes";
import { type StarterBrick } from "@/types/extensionPointTypes";
import { type UUID } from "@/types/stringTypes";
import { type IReader } from "@/types/bricks/readerTypes";
import initialize from "@/vendors/initialize";

interface ShadowDOM {
  mode?: "open" | "closed";
  tag?: string;
}

/**
 * @since 1.7.8
 */
export type AttachMode =
  // Add menu items once. If a menu item is removed, PixieBrix will still attempt to re-add it.
  | "once"
  // Watch for new menus on the screen and add menu items to them
  | "watch";

const DATA_ATTR = "data-pb-uuid";

const MENU_INSTALL_ERROR_DEBOUNCE_MS = 1000;

export type MenuItemExtensionConfig = {
  /**
   * The button caption to supply to the `caption` in the extension point template.
   * If `dynamicCaption` is true, can include template expressions.
   */
  caption: string;

  /**
   * (Optional) the icon to supply to the icon in the extension point template
   */
  icon?: IconConfig;

  /**
   * The action to perform when the button is clicked
   */
  action: BrickConfig | BrickPipeline;

  /**
   * (Experimental) condition to determine whether to show the menu item
   * @see if
   */
  if?: BrickConfig | BrickPipeline;

  /**
   * (Experimental) re-install the menu if an off the selectors change.
   * @see if
   */
  dependencies?: string[];

  /**
   * True if caption is determined dynamically (using the reader and templating)
   */
  dynamicCaption?: boolean;

  /**
   * True to prevent button to be clicked again while action is in progress
   */
  synchronous: boolean;

  /**
   * (Experimental) message to show on error running the extension
   */
  onError?: MessageConfig;
  /**
   * (Experimental) message to show if the user cancelled the action (e.g., cancelled a form, or the Cancel brick ran)
   */
  onCancel?: MessageConfig;
  /**
   * (Experimental) message to show on success when running the extension
   */
  onSuccess?: MessageConfig | boolean;
};

const actionSchema: Schema = {
  oneOf: [
    { $ref: "https://app.pixiebrix.com/schemas/effect#" },
    {
      type: "array",
      items: { $ref: "https://app.pixiebrix.com/schemas/block#" },
    },
  ],
};

async function cancelOnNavigation<T>(promise: Promise<T>): Promise<T> {
  // XXX: should introduce abortable promises listening for navigation vs. checking functions that compares
  // navigation IDs. For example, see lifecycle.ts:_navigationListeners
  const startNavigationId = getNavigationId();
  const isNavigationCancelled = () => getNavigationId() !== startNavigationId;
  return rejectOnCancelled(promise, isNavigationCancelled);
}

type MenuTargetMode = "document" | "eventTarget";

export abstract class MenuItemExtensionPoint extends StarterBrickABC<MenuItemExtensionConfig> {
  /**
   * Mapping of menu container nonce UUID to the DOM element for the menu container
   * @protected
   */
  protected readonly menus: Map<UUID, HTMLElement>;

  /**
   * Set of menu container UUID that have been removed from the DOM. Track so we we know which ones we've already
   * taken action on to attempt to reacquire a menu container for
   * @private
   */
  private readonly removed: Set<UUID>;

  /**
   * Set of methods to call to cancel any DOM watchers associated with this extension point
   * @private
   */
  private readonly cancelListeners: Set<() => void>;

  /**
   * Map from extension id to callback to cancel observers for its dependencies.
   *
   * @see MenuItemExtensionConfig.dependencies
   * @private
   */
  private readonly cancelDependencyObservers: Map<UUID, () => void>;

  /**
   * True if the extension point has been uninstalled
   * @private
   */
  private uninstalled = false;

  /**
   * Mapping from extension id to the set of menu items that have been clicked and still running.
   * @see MenuItemExtensionConfig.synchronous
   * @private
   */
  private readonly runningExtensionElements = new Map<
    UUID,
    WeakSet<HTMLElement>
  >();

  private readonly notifyError = debounce(
    notify.error,
    MENU_INSTALL_ERROR_DEBOUNCE_MS,
    {
      leading: true,
      trailing: false,
    }
  ) as typeof notify.error; // `debounce` loses the overloads

  public get kind(): "menuItem" {
    return "menuItem";
  }

  public abstract get targetMode(): MenuTargetMode;

  public abstract get attachMode(): AttachMode;

  public override get defaultOptions(): { caption: string } {
    return { caption: "Custom Menu Item" };
  }

  protected constructor(metadata: Metadata, logger: Logger) {
    super(metadata, logger);
    this.menus = new Map<UUID, HTMLElement>();
    this.removed = new Set<UUID>();
    this.cancelListeners = new Set();
    this.cancelDependencyObservers = new Map<UUID, () => void>();
  }

  inputSchema: Schema = propertiesToSchema(
    {
      caption: {
        type: "string",
        description: "The caption for the menu item.",
      },
      dynamicCaption: {
        type: "boolean",
        description: "True if the caption can refer to data from the reader",
        default: "false",
      },
      if: actionSchema,
      dependencies: {
        type: "array",
        items: {
          type: "string",
        },
        minItems: 1,
      },
      action: actionSchema,
      icon: { $ref: "https://app.pixiebrix.com/schemas/icon#" },
      shadowDOM: {
        type: "object",
        description:
          "When provided, renders the menu item as using the shadowDOM",
        properties: {
          tag: {
            type: "string",
          },
          mode: {
            type: "string",
            enum: ["open", "closed"],
            default: "closed",
          },
        },
        required: ["tag"],
      },
    },
    ["caption", "action"]
  );

  private cancelAllPending(): void {
    console.debug(
      `Cancelling ${this.cancelListeners.size} menuItemExtension observers`
    );

    for (const cancelObserver of this.cancelListeners) {
      try {
        // `cancelObserver` should always be defined given its type. But check just in case since we don't have
        // strictNullChecks on
        if (cancelObserver) {
          cancelObserver();
        }
      } catch (error) {
        // Try to proceed as normal
        reportError(error, { context: this.logger.context });
      }
    }

    this.cancelListeners.clear();
  }

  clearExtensionInterfaceAndEvents(extensionIds: UUID[]): void {
    console.debug(
      "Remove extensionIds for menuItem extension point: %s",
      this.id,
      { extensionIds }
    );
    // Can't use this.menus.values() here b/c because it may have already been cleared
    for (const extensionId of extensionIds) {
      const $item = $safeFind(`[${DATA_ATTR}="${extensionId}"]`);
      if ($item.length === 0) {
        console.warn(`Item for ${extensionId} was not in the menu`);
      }

      $item.remove();
    }
  }

  public override uninstall(): void {
    this.uninstalled = true;

    const menus = [...this.menus.values()];

    // Clear so they don't get re-added by the onNodeRemoved mechanism
    const extensions = this.extensions.splice(0, this.extensions.length);
    this.menus.clear();

    if (extensions.length === 0) {
      console.warn(
        `uninstall called on menu extension point with no extensions: ${this.id}`
      );
    }

    console.debug(
      `Uninstalling ${menus.length} menus for ${extensions.length} extensions`
    );

    this.cancelAllPending();

    for (const element of menus) {
      try {
        this.clearExtensionInterfaceAndEvents(extensions.map((x) => x.id));
        // Release the menu element
        element.removeAttribute(EXTENSION_POINT_DATA_ATTR);
      } catch (error) {
        this.logger.error(error);
      }
    }

    for (const extension of extensions) {
      const clear = this.cancelDependencyObservers.get(extension.id);
      if (clear) {
        try {
          clear();
        } catch {
          console.error("Error cancelling dependency observer");
        }
      }

      this.cancelDependencyObservers.delete(extension.id);
    }
  }

  /**
   * Returns the selector root for bricks attached to the menuItem.
   * @param $buttonElement the element that triggered the menu
   */
  abstract getPipelineRoot($buttonElement: JQuery): SelectorRoot;

  /**
   * Returns the selector root provided to the reader.
   * @param $containerElement
   * @param $buttonElement
   */
  abstract getReaderRoot({
    $containerElement,
    $buttonElement,
  }: {
    $containerElement: JQuery;
    $buttonElement: JQuery;
  }): SelectorRoot;

  abstract getTemplate(): string;

  abstract getContainerSelector(): string | string[];

  addMenuItem($menu: JQuery, $menuItem: JQuery): void {
    $menu.append($menuItem);
  }

  async getBlocks(
    extension: ResolvedExtension<MenuItemExtensionConfig>
  ): Promise<Brick[]> {
    return selectAllBlocks(extension.config.action);
  }

  /**
   * Callback when a menu is removed from the page to wait to re-install the menu if the container is re-added.
   * Used to handle SPA page transitions that don't navigate (e.g., modals, tabs, etc.)
   * @param menuNonce the menu nonce generated in attachMenus
   * @private
   */
  private async reacquire(menuNonce: UUID): Promise<void> {
    if (this.attachMode === "watch") {
      throw new Error("reacquire should not be called in watch mode");
    }

    if (this.uninstalled) {
      console.warn(
        `${this.instanceNonce}: cannot reacquire because extension ${this.id} is destroyed`
      );
      return;
    }

    const alreadyRemoved = this.removed.has(menuNonce);
    this.removed.add(menuNonce);
    if (alreadyRemoved) {
      console.warn(
        `${this.instanceNonce}: menu ${menuNonce} removed from DOM multiple times for ${this.id}`
      );
    } else {
      console.debug(
        `${this.instanceNonce}: menu ${menuNonce} removed from DOM for ${this.id}`
      );
      this.menus.delete(menuNonce);
      // Re-install the menus (will wait for the menu selector to re-appear if there's no copies of it on the page)
      // The behavior for multiple buttons is quirky here for "once" attachMode. There's a corner case where
      // 1) if one button is removed, 2) the menus are re-added immediately, 3) PixieBrix stops watching for new buttons
      await this.waitAttachMenus();
      await this.run({ reason: RunReason.MUTATION });
    }
  }

  /**
   * Attach extension point to the provided menu containers.
   * @param $menuContainers
   * @private
   */
  private attachMenus($menuContainers: JQuery): void {
    const existingMenuContainers = new Set(this.menus.values());

    const cleanupCallbacks = [];
    for (const element of $menuContainers) {
      // Only acquire new menu items, otherwise we end up with duplicate entries in this.menus which causes
      // repeat evaluation of menus in this.run
      if (!existingMenuContainers.has(element)) {
        const menuNonce = uuidv4();
        this.menus.set(menuNonce, element);

        const acquired = acquireElement(element, this.id);

        if (acquired && this.attachMode === "once") {
          // Only re-acquire in "once" attachMode. In "watch" the menu will automatically be re-acquired when the
          // element is re-initialized on the page
          cleanupCallbacks.push(
            onNodeRemoved(element, async () => this.reacquire(menuNonce))
          );
        }
      }
    }

    for (const cleanupCallback of cleanupCallbacks) {
      this.cancelListeners.add(cleanupCallback);
    }
  }

  /**
   * Watch for new menus to appear on the screen, e.g., due to SPA page transition, infinite scroll, etc.
   * @private
   */
  private watchMenus(): void {
    const containerSelector = this.getContainerSelector();

    if (typeof containerSelector !== "string") {
      throw new BusinessError(
        "Array of container selectors not supported for attachMode: 'watch'"
      );
    }

    // Watch for new containers on the page on the page
    const mutationObserver = initialize(
      containerSelector,
      (index, element) => {
        this.attachMenus($(element as HTMLElement));
        void this.run({ reason: RunReason.MUTATION });
      },
      // `target` is a required option. Would it be possible to scope if the selector is nested? Would have to consider
      // commas in the selector. E.g., revert back to document if there's a comma
      { target: document }
    );

    this.cancelListeners.add(() => {
      mutationObserver.disconnect();
    });
  }

  /**
   * Find and claim the new menu containers currently on the page for the extension point.
   * @return true iff one or more menu containers were found
   * @private
   */
  private async waitAttachMenus(): Promise<boolean> {
    if (this.uninstalled) {
      console.error("Menu item extension point is uninstalled", {
        extensionPointNonce: this.instanceNonce,
      });
      throw new Error(
        "Cannot install menu item because starter brick was uninstalled"
      );
    }

    const containerSelector = this.getContainerSelector();

    console.debug(
      `${this.instanceNonce}: awaiting menu container for ${this.id}`,
      {
        selector: containerSelector,
      }
    );

    const [menuPromise, cancelWait] = awaitElementOnce(containerSelector);
    this.cancelListeners.add(cancelWait);

    let $menuContainers;

    try {
      $menuContainers = (await cancelOnNavigation(menuPromise)) as JQuery;
    } catch (error) {
      console.debug(
        `${this.instanceNonce}: stopped awaiting menu container for ${this.id}`,
        { error }
      );
      throw error;
    }

    this.attachMenus($menuContainers);

    if (this.attachMode === "watch") {
      this.watchMenus();
    }

    return this.menus.size > 0;
  }

  async install(): Promise<boolean> {
    const isAvailable = await this.isAvailable();
    if (!isAvailable) {
      return false;
    }

    return this.waitAttachMenus();
  }

  protected abstract makeItem(
    html: string,
    extension: ResolvedExtension<MenuItemExtensionConfig>
  ): JQuery;

  private async runExtension(
    menu: HTMLElement,
    ctxtPromise: Promise<JsonObject>,
    extension: ResolvedExtension<MenuItemExtensionConfig>
  ) {
    if (!extension.id) {
      this.logger.error(`Refusing to run mod without id for ${this.id}`);
      return;
    }

    const extensionLogger = this.logger.childLogger(
      selectExtensionContext(extension)
    );

    console.debug(
      `${this.instanceNonce}: running menuItem extension ${extension.id}`
    );

    // Safe because menu is an HTMLElement, not a string
    const $menu = $(menu);

    const {
      caption,
      dynamicCaption = false,
      action: actionConfig,
      onCancel = {},
      onError = {},
      onSuccess = {},
      icon = { id: "box", size: 18 },
      synchronous,
    } = extension.config;

    const versionOptions = apiVersionOptions(extension.apiVersion);

    const implicitRender = versionOptions.explicitRender
      ? null
      : engineRenderer(
          extension.templateEngine ?? DEFAULT_IMPLICIT_TEMPLATE_ENGINE,
          versionOptions
        );

    let html: string;

    if (extension.config.if) {
      // Read the latest state at the time of the action
      const input = await ctxtPromise;
      const serviceContext = await makeServiceContext(extension.services);

      console.debug("Checking menuItem precondition", {
        input,
        serviceContext,
      });

      // There's no button at this point, so can't use the eventTarget targetMode
      if (this.targetMode !== "document") {
        throw new BusinessError(
          `targetMode ${this.targetMode} not supported for conditional menu items`
        );
      }

      const initialValues: InitialValues = {
        input,
        serviceContext,
        optionsArgs: extension.optionsArgs,
        root: document,
      };

      // NOTE: don't use reduceExtensionPipeline because this is just evaluating the condition and shouldn't show up
      // as a "run" in the logs/traces. We also leave off the extensionLogger (see note)
      const show = await reducePipeline(extension.config.if, initialValues, {
        // Don't pass extension: extensionLogger because our log display doesn't handle the in-extension point
        // conditionals yet
        ...versionOptions,
      });

      if (!show) {
        this.watchDependencies(extension);
        return;
      }
    }

    const renderMustache = engineRenderer("mustache", versionOptions);

    if (dynamicCaption) {
      const ctxt = await ctxtPromise;
      const serviceContext = await makeServiceContext(extension.services);

      // Integrations take precedence over the other context
      // XXX: don't support adding "@mod" variable for now. Dynamic Captions are not available in the Page Editor
      const extensionContext = { ...ctxt, ...serviceContext };

      html = (await renderMustache(this.getTemplate(), {
        caption: (await mapArgs(caption, extensionContext, {
          implicitRender,
          autoescape: versionOptions.autoescape,
        })) as string,
        icon: icon ? await getSvgIcon(icon) : null,
      })) as string;
    } else {
      html = (await renderMustache(this.getTemplate(), {
        caption,
        icon: icon ? await getSvgIcon(icon) : null,
      })) as string;
    }

    const $menuItem = this.makeItem(html, extension);

    $menuItem.on("click", async (event) => {
      let runningElements: WeakSet<HTMLElement> =
        this.runningExtensionElements.get(extension.id);
      if (runningElements == null) {
        runningElements = new WeakSet([event.target]);
        this.runningExtensionElements.set(extension.id, runningElements);
      } else {
        if (synchronous && runningElements.has(event.target)) {
          return;
        }

        runningElements.add(event.target);
      }

      try {
        event.preventDefault();
        event.stopPropagation();

        console.debug("Run menu item", this.logger.context);

        reportEvent("MenuItemClick", selectEventData(extension));

        try {
          // Read the latest state at the time of the action
          const reader = await this.defaultReader();

          const initialValues: InitialValues = {
            input: await reader.read(
              this.getReaderRoot({
                $containerElement: $menu,
                $buttonElement: $menuItem,
              })
            ),
            serviceContext: await makeServiceContext(extension.services),
            optionsArgs: extension.optionsArgs,
            root: this.getPipelineRoot($menuItem),
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
            showNotification({
              ...DEFAULT_ACTION_RESULTS.cancel,
              ...pick(onCancel, "message", "type"),
            });
          } else {
            extensionLogger.error(error);
            showNotification({
              ...DEFAULT_ACTION_RESULTS.error,
              ...pick(onError, "message", "type"),
            });
          }
        }
      } finally {
        runningElements.delete(event.target);
      }
    });

    const $existingItem = $menu.find(`[${DATA_ATTR}="${extension.id}"]`);

    if ($existingItem.length > 0) {
      // We don't need to unbind any click handlers because we're replacing the element completely.
      console.debug(
        `Replacing existing menu item for ${extension.id} (${extension.label})`
      );
      $existingItem.replaceWith($menuItem);
    } else {
      console.debug(
        `Adding new menu item ${extension.id} (${extension.label})`
      );
      this.addMenuItem($menu, $menuItem);
    }

    this.watchDependencies(extension);

    if (process.env.DEBUG) {
      const cancelObserver = onNodeRemoved($menuItem.get(0), () => {
        // Don't re-install here. We're reinstalling the entire menu
        console.debug(`Menu item for ${extension.id} was removed from the DOM`);
      });
      this.cancelListeners.add(cancelObserver);
    }
  }

  watchDependencies(
    extension: ResolvedExtension<MenuItemExtensionConfig>
  ): void {
    const { dependencies = [] } = extension.config;

    // Clean up old observers
    if (this.cancelDependencyObservers.has(extension.id)) {
      this.cancelDependencyObservers.get(extension.id)();
      this.cancelDependencyObservers.delete(extension.id);
    }

    if (dependencies.length > 0) {
      const rerun = once(() => {
        console.debug("Dependency changed, re-running extension");
        void this.run({
          reason: RunReason.DEPENDENCY_CHANGED,
          extensionIds: [extension.id],
        });
      });

      const observer = new MutationObserver(rerun);

      const cancellers: Array<() => void> = [];

      let elementCount = 0;
      for (const dependency of dependencies) {
        const $dependency = $safeFind(dependency);
        if ($dependency.length > 0) {
          for (const element of $dependency) {
            elementCount++;
            observer.observe(element, {
              childList: true,
              subtree: true,
            });
          }
        } else {
          const [elementPromise, cancel] = awaitElementOnce(dependency);
          cancellers.push(cancel);
          // eslint-disable-next-line promise/prefer-await-to-then -- TODO: Maybe refactor
          void elementPromise.then(() => {
            rerun();
          });
        }
      }

      console.debug(
        `Observing ${elementCount} element(s) for extension: ${extension.id}`
      );

      this.cancelDependencyObservers.set(extension.id, () => {
        try {
          observer.disconnect();
        } catch (error) {
          console.error("Error cancelling mutation observer", error);
        }

        for (const cancel of cancellers) {
          try {
            cancel();
          } catch (error) {
            console.error("Error cancelling dependency observer", error);
          }
        }
      });
    } else {
      console.debug(`Extension has no dependencies: ${extension.id}`);
    }
  }

  async run({ extensionIds = null }: RunArgs): Promise<void> {
    if (this.menus.size === 0 || this.extensions.length === 0) {
      return;
    }

    const startNavigationId = getNavigationId();
    const isNavigationCancelled = () => getNavigationId() !== startNavigationId;

    const errors = [];

    const containerSelector = this.getContainerSelector();
    const $currentMenus = $safeFind(castArray(containerSelector).join(" "));
    const currentMenus = $currentMenus.toArray();

    for (const menu of this.menus.values()) {
      if (!currentMenus.includes(menu)) {
        console.debug(
          "Skipping menu because it's no longer found by the container selector"
        );
        continue;
      }

      // eslint-disable-next-line no-await-in-loop -- TODO: Make it run in parallel if possible while maintaining the order
      const reader = await this.defaultReader();

      let ctxtPromise: Promise<JsonObject>;

      for (const extension of this.extensions) {
        // Run in order so that the order stays the same for where they get rendered. The service
        // context is the only thing that's async as part of the initial configuration right now

        if (extensionIds != null && !extensionIds.includes(extension.id)) {
          continue;
        }

        if (isNavigationCancelled()) {
          continue;
        }

        if (extension.config.dynamicCaption || extension.config.if) {
          // Lazily read context for the menu if one of the extensions actually uses it

          // Wrap in rejectOnCancelled because if the reader takes a long time to run, the user may
          // navigate away from the page before the reader comes back.
          ctxtPromise = rejectOnCancelled(
            reader.read(
              this.getReaderRoot({
                $containerElement: $(menu),
                $buttonElement: null,
              })
            ),
            isNavigationCancelled
          );
        }

        try {
          // eslint-disable-next-line no-await-in-loop -- TODO: Make it run in parallel if possible while maintaining the order
          await this.runExtension(menu, ctxtPromise, extension);
        } catch (error) {
          if (error instanceof PromiseCancelled) {
            console.debug(
              `menuItemExtension run promise cancelled for extension: ${extension.id}`
            );
          } else {
            errors.push(error);
            reportError(error, {
              context: {
                deploymentId: extension._deployment?.id,
                extensionPointId: extension.extensionPointId,
                extensionId: extension.id,
              },
            });
          }
        }
      }
    }

    if (errors.length > 0) {
      const subject = pluralize(errors.length, "the button", "$$ buttons");
      const message = `An error occurred adding ${subject}`;
      console.warn(message, { errors });
      this.notifyError({
        message,
        reportError: false, // We already reported it in the loop above
      });
    }
  }
}

interface MenuDefaultOptions {
  caption?: string;
  [key: string]: string;
}

export type MenuPosition =
  | "append"
  | "prepend"
  | {
      // Element to insert the menu item before, selector is relative to the container
      sibling: string | null;
    };

/**
 * @since 1.7.16
 */

export interface MenuDefinition extends StarterBrickDefinition {
  type: "menuItem";
  /**
   * The HTML template to render the button/menu item.
   */
  template: string;
  /**
   * Position in the menu to insert the item.
   */
  position?: MenuPosition;
  /**
   * Selector targeting the menu location
   */
  containerSelector: string;
  /**
   * Selector passed to `.parents()` to determine the reader context. Must match exactly one element.
   * See https://api.jquery.com/parents/
   * @deprecated use targetMode and the Traverse Elements brick instead
   */
  readerSelector?: string;
  /**
   * The element to pass as the root to the readers and extension (default="document")
   * @since 1.7.16
   * @see readerSelector
   */
  targetMode?: MenuTargetMode;
  /**
   * Wrap menu item in a shadow DOM
   * @deprecated do we still want to support this? Is it used anywhere?
   */
  shadowDOM?: ShadowDOM;
  /**
   * Default options for IExtensions attached to the extension point
   */
  defaultOptions?: MenuDefaultOptions;
  /**
   * Mode for attaching the menu to the page. Defaults to "once"
   * @since 1.7.28
   */
  attachMode?: AttachMode;
}

export class RemoteMenuItemExtensionPoint extends MenuItemExtensionPoint {
  private readonly _definition: MenuDefinition;

  public readonly permissions: Permissions.Permissions;

  public readonly rawConfig: StarterBrickConfig<MenuDefinition>;

  public override get defaultOptions(): {
    caption: string;
    [key: string]: string;
  } {
    const { caption, ...defaults } = this._definition.defaultOptions ?? {};
    return {
      caption: caption ?? super.defaultOptions.caption,
      ...defaults,
    };
  }

  constructor(config: StarterBrickConfig<MenuDefinition>) {
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

  override addMenuItem($menu: JQuery, $menuItem: JQuery): void {
    const { position = "append" } = this._definition;

    if (typeof position === "object") {
      if (position.sibling) {
        const $sibling = $safeFind(position.sibling, $menu);
        if ($sibling.length > 1) {
          throw new Error(
            `Multiple sibling elements for selector: ${position.sibling}`
          );
        }

        if ($sibling.length === 1) {
          $sibling.before($menuItem);
        } else {
          // Didn't find the sibling, so just try inserting it at the end
          $menu.append($menuItem);
        }
      } else {
        // No element to insert the item before, so insert it at the end.
        $menu.append($menuItem);
      }
    } else {
      switch (position) {
        case "prepend":
        case "append": {
          // Safe because we're checking the value in the case statements
          // eslint-disable-next-line security/detect-object-injection
          $menu[position]($menuItem);
          break;
        }

        default: {
          throw new Error(`Unexpected position ${String(position)}`);
        }
      }
    }
  }

  override getReaderRoot({
    $containerElement,
    $buttonElement,
  }: {
    $containerElement: JQuery;
    $buttonElement: JQuery | null;
  }): SelectorRoot {
    if (this._definition.readerSelector && this.targetMode !== "document") {
      throw new BusinessError(
        "Cannot provide both readerSelector and targetMode"
      );
    }

    const selector = this._definition.readerSelector;
    if (selector) {
      if ($containerElement.length > 1) {
        console.warn("getReaderRoot called with multiple containerElements");
      }

      const $elements = $containerElement.parents(selector);
      if ($elements.length > 1) {
        throw new MultipleElementsFoundError(
          selector,
          "Multiple elements found for reader selector"
        );
      }

      if ($elements.length === 0) {
        throw new NoElementsFoundError(
          selector,
          "No elements found for reader selector"
        );
      }

      return $elements.get(0);
    }

    if (this.targetMode === "eventTarget") {
      if ($buttonElement == null) {
        throw new BusinessError(
          "eventTarget not supported for buttons with dynamic captions"
        );
      }

      return $buttonElement.get()[0];
    }

    return document;
  }

  override getPipelineRoot($buttonElement: JQuery): SelectorRoot {
    if (this.targetMode === "eventTarget") {
      return $buttonElement.get()[0];
    }

    return document;
  }

  override async defaultReader(): Promise<IReader> {
    return mergeReaders(this._definition.reader);
  }

  override getContainerSelector(): string {
    return this._definition.containerSelector;
  }

  override getTemplate(): string {
    return this._definition.template;
  }

  override get attachMode(): AttachMode {
    return this._definition.attachMode ?? "once";
  }

  override get targetMode(): MenuTargetMode {
    return this._definition.targetMode ?? "document";
  }

  protected makeItem(
    unsanitizedHTML: string,
    extension: ResolvedExtension<MenuItemExtensionConfig>
  ): JQuery {
    const sanitizedHTML = sanitize(unsanitizedHTML);

    let $root: JQuery;

    if (this._definition.shadowDOM) {
      const root = document.createElement(this._definition.shadowDOM.tag);
      const shadowRoot = root.attachShadow({ mode: "closed" });
      shadowRoot.innerHTML = sanitizedHTML;
      $root = $(root);
    } else {
      $root = $(sanitizedHTML);
    }

    $root.attr(DATA_ATTR, extension.id);

    return $root;
  }

  async isAvailable(): Promise<boolean> {
    return checkAvailable(this._definition.isAvailable);
  }
}

export function fromJS(
  config: StarterBrickConfig<MenuDefinition>
): StarterBrick {
  const { type } = config.definition;
  if (type !== "menuItem") {
    // `type` is `never` here due to the if-statement
    throw new Error(`Expected type=menuItem, got ${type as string}`);
  }

  return new RemoteMenuItemExtensionPoint(config);
}
