/*
 * Copyright (C) 2024 PixieBrix, Inc.
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
import { ReusableAbortController } from "abort-utils";
import {
  type CustomEventOptions,
  type DebounceOptions,
  StarterBrickABC,
  type StarterBrickDefinitionLike,
  type StarterBrickDefinitionProp,
} from "@/starterBricks/types";
import { type Permissions } from "webextension-polyfill";
import { castArray, cloneDeep, compact, debounce, noop } from "lodash";
import { checkAvailable } from "@/bricks/available";
import reportEvent from "@/telemetry/reportEvent";
import { Events } from "@/telemetry/events";
import {
  awaitElementOnce,
  selectExtensionContext,
} from "@/starterBricks/helpers";
import { type BrickConfig, type BrickPipeline } from "@/bricks/types";
import { selectEventData } from "@/telemetry/deployments";
import apiVersionOptions from "@/runtime/apiVersionOptions";
import { collectAllBricks } from "@/bricks/util";
import { mergeReaders } from "@/bricks/readers/readerUtils";
import initialize from "@/vendors/jQueryInitialize";
import pluralize from "@/utils/pluralize";
import { PromiseCancelled } from "@/errors/genericErrors";
import { BusinessError } from "@/errors/businessErrors";
import { guessSelectedElement } from "@/utils/selectionController";
import "@/vendors/hoverintent";
import ArrayCompositeReader from "@/bricks/readers/ArrayCompositeReader";
import {
  type AttachMode,
  type IntervalArgs,
  type ReportMode,
  type TargetMode,
  type Trigger,
  USER_ACTION_TRIGGERS,
} from "@/starterBricks/triggerExtensionTypes";
import {
  getEventReader,
  getShimEventReader,
  pickEventProperties,
} from "@/starterBricks/triggerEventReaders";
import CompositeReader from "@/bricks/readers/CompositeReader";
import { type Reader } from "@/types/bricks/readerTypes";
import { type UUID } from "@/types/stringTypes";
import { type ResolvedModComponent } from "@/types/modComponentTypes";
import { type Brick } from "@/types/brickTypes";
import { type Schema } from "@/types/schemaTypes";
import { type SelectorRoot } from "@/types/runtimeTypes";
import { type JsonObject } from "type-fest";
import { type StarterBrick } from "@/types/starterBrickTypes";
import {
  isContextInvalidatedError,
  notifyContextInvalidated,
} from "@/errors/contextInvalidated";
import { sleep } from "@/utils/timeUtils";
import {
  $safeFind,
  runOnDocumentVisible,
  waitAnimationFrame,
} from "@/utils/domUtils";
import makeIntegrationsContextFromDependencies from "@/integrations/util/makeIntegrationsContextFromDependencies";
import { allSettled } from "@/utils/promiseUtils";
import type { PlatformCapability } from "@/platform/capabilities";
import type { PlatformProtocol } from "@/platform/platformProtocol";
import { propertiesToSchema } from "@/utils/schemaUtils";
import { assertNotNullish } from "@/utils/nullishUtils";

type TriggerTarget = Document | HTMLElement;

export type TriggerConfig = {
  action: BrickPipeline | BrickConfig;
};

/**
 * Returns the default error/event reporting mode for the trigger type.
 * @param trigger the trigger type
 */
export function getDefaultReportModeForTrigger(trigger: Trigger): ReportMode {
  return USER_ACTION_TRIGGERS.includes(trigger) ? "all" : "once";
}

/**
 * Return the default allowInactiveFrame value for the trigger type.
 * @param trigger the trigger type
 *
 * @see TriggerStarterBrickABC.allowInactiveFrames
 */
export function getDefaultAllowInactiveFramesForTrigger(
  trigger: Trigger,
): boolean {
  // Prior to 1.8.7, the `background` flag was ignored for non-interval triggers. Therefore, the effective
  // default was `true` for non-interval triggers.
  return trigger !== "interval";
}

async function interval({
  intervalMillis,
  effectGenerator,
  signal,
  requestAnimationFrame,
}: IntervalArgs) {
  // Don't run the effect immediately. Wait for the interval first. In the future we might consider adding a "leading"
  // boolean argument to control whether the interval fires immediately
  await sleep(intervalMillis);

  while (!signal.aborted) {
    const start = Date.now();

    try {
      if (requestAnimationFrame) {
        // eslint-disable-next-line no-await-in-loop -- intentionally running in sequence
        await waitAnimationFrame();
      }

      // eslint-disable-next-line no-await-in-loop -- intentionally running in sequence
      await effectGenerator();
    } catch {
      // NOP
    }

    const sleepDuration = Math.max(0, intervalMillis - (Date.now() - start));

    if (sleepDuration > 0) {
      // Would also be OK to pass 0 to sleep duration
      // eslint-disable-next-line no-await-in-loop -- intentionally running in sequence
      await sleep(sleepDuration);
    }
  }

  console.debug("interval:completed");
}

export abstract class TriggerStarterBrickABC extends StarterBrickABC<TriggerConfig> {
  abstract get trigger(): Trigger;

  abstract get attachMode(): AttachMode;

  abstract get intervalMillis(): number;

  /**
   * Allow trigger to run even when the tab is not active.
   *
   * NOTE: this property does not refer to running the trigger in the extension's background page. PixieBrix currently
   * only supports running mods in the context of a frame's content script.
   *
   * @see TriggerDefinition.background
   */
  abstract get allowInactiveFrames(): boolean;

  abstract get targetMode(): TargetMode;

  abstract get reportMode(): ReportMode;

  abstract get showErrors(): boolean;

  abstract get debounceOptions(): DebounceOptions;

  abstract get customTriggerOptions(): CustomEventOptions | undefined;

  abstract get triggerSelector(): string | undefined;

  abstract getBaseReader(): Promise<Reader>;

  /**
   * Map from mod component ID to elements a trigger is currently running on.
   */
  private readonly runningModComponentElements = new Map<
    UUID,
    WeakSet<TriggerTarget>
  >();

  /**
   * Controller to drop observers
   */
  private readonly observersController = new ReusableAbortController();

  /**
   * Controller to drop event listeners and timers
   */
  private readonly cancelHandlers = new ReusableAbortController();

  // Extensions that have errors/events reported. NOTE: this tracked per contentScript instance. These are not
  // reset on Single Page Application navigation events
  private readonly reportedEvents = new Set<UUID>();
  private readonly reportedErrors = new Set<UUID>();

  public get kind(): "trigger" {
    return "trigger";
  }

  readonly capabilities: PlatformCapability[] = ["dom", "state"];

  /**
   * Returns true if an event should be reported, given whether it has already been reported.
   * @param alreadyReported true if the event has already been reported
   */
  private shouldReport(alreadyReported: boolean): boolean {
    switch (this.reportMode) {
      case "once": {
        return !alreadyReported;
      }

      case "all": {
        return true;
      }

      default: {
        const exhaustiveCheck: never = this.reportMode;
        throw new BusinessError(`Invalid reportMode: ${exhaustiveCheck}`);
      }
    }
  }

  /**
   * Return true if an error should be reported.
   */
  private shouldReportError({
    extensionId,
    error,
  }: {
    extensionId?: UUID;
    error: unknown;
  }): boolean {
    if (
      isContextInvalidatedError(error) &&
      !USER_ACTION_TRIGGERS.includes(this.trigger)
    ) {
      // Fail silently on non-interactive triggers if the background page has been reloaded. Otherwise, the user
      // receives confusing notifications that aren't tied to actions they've taken.
      return false;
    }

    if (extensionId) {
      const alreadyReported = this.reportedErrors.has(extensionId);
      this.reportedErrors.add(extensionId);
      return this.shouldReport(alreadyReported);
    }

    return true;
  }

  /**
   * Return true if an event should be reported for the given extension id.
   */
  private shouldReportEvent(componentId: UUID): boolean {
    const alreadyReported = this.reportedEvents.has(componentId);
    this.reportedEvents.add(componentId);
    return this.shouldReport(alreadyReported);
  }

  async install(): Promise<boolean> {
    if (this.debounceOptions?.waitMillis) {
      const { waitMillis, ...options } = this.debounceOptions;
      this.debouncedRunTriggersAndNotify = debounce(
        this._runTriggersAndNotify,
        waitMillis,
        options,
      ) as typeof this.debouncedRunTriggersAndNotify;
    } else if (this.trigger !== "interval" && !this.allowInactiveFrames) {
      // Since 1.8.7, respect the `background` flag for non-interval triggers.
      // @ts-expect-error -- Promise<Promise<void>> is same as Promise<void> when awaited b/c await is recursive
      this.debouncedRunTriggersAndNotify = runOnDocumentVisible(
        this._runTriggersAndNotify,
      );
    }

    return this.isAvailable();
  }

  cancelObservers(): void {
    console.debug("TriggerExtensionPoint:cancelObservers", {
      id: this.id,
      instanceNonce: this.instanceNonce,
    });

    // Inform and discard registered observers
    this.observersController.abortAndReset();
  }

  addCancelHandler(callback: () => void): void {
    this.cancelHandlers.signal.addEventListener("abort", callback);
  }

  clearModComponentInterfaceAndEvents(): void {
    // NOP: the unregisterExtensionEvents method doesn't need to unregister anything from the page because the
    // observers/handlers are installed for the extensionPoint instance itself, not the extensions. I.e., there's a
    // single load/click/etc. trigger that's shared by all extensions using this extension point.
  }

  override uninstall(): void {
    // Clean up observers
    this.cancelObservers();

    // NOTE: you might think we could use a WeakSet of HTMLElement to track which elements we've actually attached
    // DOM events too. However, we can't because WeakSet is not an enumerable collection
    // https://esdiscuss.org/topic/removal-of-weakmap-weakset-clear
    const $currentElements: JQuery<TriggerTarget> = this.triggerSelector
      ? $safeFind(this.triggerSelector)
      : $(document);

    console.debug("TriggerExtensionPoint:uninstall", {
      id: this.id,
      instanceNonce: this.instanceNonce,
      trigger: this.trigger,
      $currentElements,
    });

    // This won't impact with other trigger extension points because the handler reference is unique to `this`
    this.cancelHandlers.abortAndReset();

    // Remove all extensions to prevent them from running if there are any straggler event handlers on the page
    this.modComponents.length = 0;
  }

  inputSchema: Schema = propertiesToSchema(
    {
      action: {
        $ref: "https://app.pixiebrix.com/schemas/effect#",
      },
    },
    ["action"],
  );

  async getBricks(
    modComponent: ResolvedModComponent<TriggerConfig>,
  ): Promise<Brick[]> {
    return collectAllBricks(modComponent.config.action);
  }

  override async defaultReader(): Promise<Reader> {
    const eventReader = getEventReader(this.trigger);

    return new ArrayCompositeReader(
      compact([
        // Because defaultReader is used outputSchema, only include eventReader if it's actually applicable so
        // @input.event doesn't show up in autocomplete/etc. otherwise
        eventReader ? new CompositeReader({ event: eventReader }) : null,
        await this.getBaseReader(),
      ]),
    );
  }

  override async previewReader(): Promise<Reader> {
    const shim = getShimEventReader(this.trigger) as Reader;

    return new ArrayCompositeReader(
      compact([
        shim ? new CompositeReader({ event: shim }) : null,
        await this.getBaseReader(),
      ]),
    );
  }

  private async runModComponent(
    ctxt: JsonObject,
    modComponent: ResolvedModComponent<TriggerConfig>,
    root: SelectorRoot,
  ) {
    const componentLogger = this.logger.childLogger(
      selectExtensionContext(modComponent),
    );

    const { action: actionConfig } = modComponent.config;

    const initialValues: InitialValues = {
      input: ctxt,
      root,
      serviceContext: await makeIntegrationsContextFromDependencies(
        modComponent.integrationDependencies,
      ),
      optionsArgs: modComponent.optionsArgs,
    };

    await reduceExtensionPipeline(actionConfig, initialValues, {
      logger: componentLogger,
      ...apiVersionOptions(modComponent.apiVersion),
    });
  }

  /**
   * Shared event handler for DOM event triggers
   * It's bound to this instance so that it can be removed when the mod is deactivated.
   */
  private readonly eventHandler = async (event: Event | undefined) => {
    assertNotNullish(event, "Event is required");

    let element = event.target as HTMLElement | Document;
    console.debug("TriggerExtensionPoint:eventHandler", {
      id: this.id,
      instanceNonce: this.instanceNonce,
      target: element,
      event,
    });

    if (this.trigger === "selectionchange") {
      element = guessSelectedElement() ?? document;
    }

    if (this.targetMode === "root") {
      assertNotNullish(this.triggerSelector, "Trigger selector is required");
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- some element will match
      element = $(element).closest(this.triggerSelector).get(0)!;
      console.debug(
        "Locating closest element for target: %s",
        this.triggerSelector,
      );
    }

    await this.debouncedRunTriggersAndNotify([element], {
      nativeEvent: event,
    });
  };

  /**
   * Mark a run as in-progress for an extension. Used to enforce synchronous execution of a
   * trigger on a particular element.
   * @param modComponentId the UUID of the mod component
   * @param element the element the trigger is running against
   */
  private markRun(modComponentId: UUID, element: TriggerTarget): void {
    if (this.runningModComponentElements.has(modComponentId)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion -- .has() check
      this.runningModComponentElements.get(modComponentId)!.add(element);
    } else {
      this.runningModComponentElements.set(modComponentId, new Set([element]));
    }
  }

  /**
   * Run all mod components for a given root (i.e., handle the trigger firing).
   *
   * DO NOT CALL DIRECTLY: should only be called from runTriggersAndNotify
   */
  private async _runTrigger(
    root: SelectorRoot,
    // Force parameter to be included to make it explicit which types of triggers pass nativeEvent
    {
      nativeEvent,
    }: {
      nativeEvent: Event | null;
    },
  ): Promise<void> {
    let extensionsToRun = this.modComponents;

    if (this.trigger === "hover") {
      // Enforce synchronous behavior for `hover` event
      extensionsToRun = extensionsToRun.filter(
        (extension) =>
          !this.runningModComponentElements.get(extension.id)?.has(root),
      );
    }

    // Don't bother running the reader if no extensions match
    if (extensionsToRun.length === 0) {
      return;
    }

    const reader = await this.getBaseReader();
    let readerContext: JsonObject;

    try {
      readerContext = {
        // The default reader overrides the event property. Should match the override precedence in defaultReader()
        event: nativeEvent ? pickEventProperties(nativeEvent) : null,
        ...(await reader.read(root)),
      };
    } catch (error) {
      if (this.shouldReportError({ error })) {
        throw error;
      }

      // Silently ignore the error
      return;
    }

    await Promise.all(
      extensionsToRun.map(async (extension) => {
        const extensionLogger = this.logger.childLogger(
          selectExtensionContext(extension),
        );
        try {
          this.markRun(extension.id, root);
          await this.runModComponent(readerContext, extension, root);
        } catch (error) {
          if (this.shouldReportError({ extensionId: extension.id, error })) {
            // Don't need to call `reportError` because it's already reported by extensionLogger
            extensionLogger.error(error);
            throw error;
          }

          // Silently ignore the error
          return;
        } finally {
          // NOTE: if the extension is not running with synchronous behavior, there's a race condition where
          // the `delete` could be called while another extension run is still in progress
          this.runningModComponentElements.get(extension.id)?.delete(root);
        }

        if (this.shouldReportEvent(extension.id)) {
          reportEvent(Events.TRIGGER_RUN, selectEventData(extension));
          extensionLogger.info("Successfully ran trigger");
        }
      }),
    );
  }

  /**
   * DO NOT CALL DIRECTLY: should call debouncedRunTriggersAndNotify.
   */
  private readonly _runTriggersAndNotify = async (
    roots: SelectorRoot[],
    // Force parameter to be included to make it explicit which types of triggers pass nativeEvent
    { nativeEvent }: { nativeEvent: Event | null },
  ): Promise<void> => {
    // Previously, run trigger returns individual extension errors. That approach was confusing, because it mixed
    // thrown errors with collected errors returned as values. Instead, we now just rely on a thrown error, and at
    // most one error will be thrown per root.
    const promises = roots.map(async (root) =>
      this._runTrigger(root, { nativeEvent }),
    );

    await allSettled(promises, {
      catch: (errors) => {
        void this.notifyErrors(errors);
      },
    });
  };

  /**
   * Run all trigger extensions for all the provided roots.
   */
  private debouncedRunTriggersAndNotify = this._runTriggersAndNotify; // Default to un-debounced

  /**
   * Show notification for errors to the user. Caller is responsible for sending error telemetry.
   */
  async notifyErrors(errors: unknown[]): Promise<void> {
    if (errors.length === 0 || !this.showErrors) {
      return;
    }

    if (errors.some((x) => isContextInvalidatedError(x))) {
      // If the error is a context invalidated error, use the standard notification
      await notifyContextInvalidated();
      return;
    }

    const subject = pluralize(errors.length, "a trigger", "$$ triggers");
    const message = `An error occurred running ${subject}`;
    console.debug(message, { errors });

    this.platform.toasts.showNotification({
      type: "error",
      message,
      // Show any information to the user about the error, so they can report/correct it.
      error: errors[0],
      reportError: false,
    });
  }

  private async getRoot(): Promise<JQuery<TriggerTarget> | undefined> {
    const rootSelector = this.triggerSelector;

    // Await for the element(s) to appear on the page so that we can
    const rootPromise = rootSelector
      ? awaitElementOnce(rootSelector, this.observersController.signal)
      : document;

    try {
      await rootPromise;
    } catch (error) {
      if (error instanceof PromiseCancelled) {
        return;
      }

      throw error;
    }

    // AwaitElementOnce doesn't work with multiple elements. Get everything that's on the current page
    const $root = rootSelector ? $safeFind(rootSelector) : $(document);

    if ($root.length === 0) {
      console.warn("No elements found for trigger selector: %s", rootSelector);
    }

    return $root;
  }

  private attachInterval() {
    this.cancelObservers();

    if (this.intervalMillis > 0) {
      this.logger.debug("Attaching interval trigger");

      const intervalEffect = async () => {
        const $root = await this.getRoot();
        assertNotNullish($root, "Root is required");
        await this.debouncedRunTriggersAndNotify([...$root], {
          nativeEvent: null,
        });
      };

      void interval({
        intervalMillis: this.intervalMillis,
        effectGenerator: intervalEffect,
        signal: this.observersController.signal,
        requestAnimationFrame: !this.allowInactiveFrames,
      });

      console.debug("TriggerExtensionPoint:attachInterval", {
        id: this.id,
        instanceNonce: this.instanceNonce,
        intervalMillis: this.intervalMillis,
      });
    } else {
      this.logger.warn(
        "Skipping interval trigger because interval is not greater than zero",
      );
    }
  }

  private attachInitializeTrigger($elements: JQuery<TriggerTarget>): void {
    this.cancelObservers();

    // The caller will have already waited for the element. So $element will contain at least one element
    if (this.attachMode === "once") {
      void this.debouncedRunTriggersAndNotify([...$elements], {
        nativeEvent: null,
      });
      return;
    }

    assertNotNullish(this.triggerSelector, "Trigger selector is required");

    const observer = initialize(
      this.triggerSelector,
      (_index, element: HTMLElement) => {
        void this.debouncedRunTriggersAndNotify([element], {
          nativeEvent: null,
        });
      },
      // `target` is a required option
      { target: document },
    );

    this.addCancelHandler(() => {
      observer.disconnect();
    });
  }

  private attachAppearTrigger($elements: JQuery): void {
    this.cancelObservers();

    // https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
    const appearObserver = new IntersectionObserver(
      (entries) => {
        const roots = entries
          .filter((x) => x.isIntersecting)
          .map((x) => x.target as HTMLElement);
        void this.debouncedRunTriggersAndNotify(roots, { nativeEvent: null });
      },
      {
        root: null,
        // RootMargin: "0px",
        threshold: 0.2,
      },
    );

    for (const element of $elements) {
      appearObserver.observe(element);
    }

    if (this.attachMode === "watch") {
      assertNotNullish(this.triggerSelector, "Trigger selector is required");

      console.debug("Watching selector: %s", this.triggerSelector);
      const mutationObserver = initialize(
        this.triggerSelector,
        (_index, element) => {
          console.debug("initialize: %s", this.triggerSelector);
          appearObserver.observe(element);
        },
        // `target` is a required option
        { target: document },
      );
      this.addCancelHandler(() => {
        mutationObserver.disconnect();
      });
    }

    this.addCancelHandler(() => {
      appearObserver.disconnect();
    });
  }

  private attachDocumentTrigger(): void {
    document.addEventListener(this.trigger, this.eventHandler, {
      signal: this.cancelHandlers.signal,
    });
  }

  private attachDOMTrigger(
    $elements: JQuery<TriggerTarget>,
    { watch = false }: { watch?: boolean },
  ): void {
    const domEventName =
      this.trigger === "custom"
        ? this.customTriggerOptions?.eventName
        : this.trigger;

    if (!domEventName) {
      throw new BusinessError("No trigger event configured for starter brick");
    }

    // Avoid duplicate events caused by:
    // 1) Navigation events on SPAs where the element remains on the page
    // 2) `watch` mode, because the observer will fire the existing elements on the page. (That re-fire will have
    //  watch: false, see observer handler below.)
    console.debug("TriggerExtensionPoint:attachDOMTrigger", {
      id: this.id,
      instanceNonce: this.instanceNonce,
      trigger: this.trigger,
      selector: this.triggerSelector,
      domEventName,
      watch,
      targetMode: this.targetMode,
    });

    if (domEventName === "hover") {
      // `hoverIntent` JQuery plugin has custom event names
      $elements.off("mouseenter.hoverIntent");
      $elements.off("mouseleave.hoverIntent");
      $elements.hoverIntent({
        over: async ({ originalEvent }) => this.eventHandler(originalEvent),
        // If `out` is not provided, over is called on both mouseenter and mouseleave
        out: noop,
      });
      this.addCancelHandler(() => {
        $elements.off("mouseenter.hoverIntent");
        $elements.off("mouseleave.hoverIntent");
      });
    } else {
      for (const element of $elements) {
        element.addEventListener(domEventName, this.eventHandler, {
          signal: this.cancelHandlers.signal,
        });
      }
    }

    if (watch) {
      if ($elements.get(0) === document) {
        console.warn(
          "TriggerExtensionPoint: ignoring watchMode for document target",
        );
        return;
      }

      // Clear out the existing mutation observer on SPA navigation events.
      // On mutation events, this watch branch is not executed because the mutation handler below passes `watch: false`
      this.cancelObservers();

      assertNotNullish(this.triggerSelector, "Trigger selector is required");

      // Watch for new elements on the page
      const mutationObserver = initialize(
        this.triggerSelector,
        (_index, element) => {
          // Already watching, so don't re-watch on the recursive call
          this.attachDOMTrigger($(element as HTMLElement), { watch: false });
        },
        // `target` is a required option
        { target: document },
      );
      this.addCancelHandler(() => {
        mutationObserver.disconnect();
      });
    }
  }

  private assertElement($root: JQuery<TriggerTarget>): asserts $root is JQuery {
    if ($root.get(0) === document) {
      throw new Error(`Trigger ${this.trigger} requires a selector`);
    }
  }

  async runModComponents(): Promise<void> {
    this.cancelObservers();

    const $root = await this.getRoot();

    switch (this.trigger) {
      case "load": {
        assertNotNullish($root, "Root is required");
        await this.debouncedRunTriggersAndNotify([...$root], {
          nativeEvent: null,
        });
        break;
      }

      case "interval": {
        this.attachInterval();
        break;
      }

      case "initialize": {
        assertNotNullish($root, "Root is required");
        this.attachInitializeTrigger($root);
        break;
      }

      case "appear": {
        assertNotNullish($root, "Root is required");
        this.assertElement($root);
        this.attachAppearTrigger($root);
        break;
      }

      case "selectionchange": {
        this.attachDocumentTrigger();
        break;
      }

      case "statechange": {
        this.attachDocumentTrigger();
        break;
      }

      case "custom": {
        assertNotNullish($root, "Root is required");
        this.attachDOMTrigger($root, { watch: false });
        break;
      }

      default: {
        if (this.trigger) {
          assertNotNullish($root, "Root is required");
          this.assertElement($root);
          this.attachDOMTrigger($root, { watch: this.attachMode === "watch" });
        } else {
          throw new BusinessError(
            "No trigger event configured for starter brick",
          );
        }
      }
    }
  }
}

type TriggerDefinitionOptions = Record<string, string>;

export interface TriggerDefinition extends StarterBrickDefinitionProp {
  defaultOptions?: TriggerDefinitionOptions;

  /**
   * The selector for the element to watch for the trigger.
   *
   * Ignored for the page `load` trigger.
   */
  rootSelector?: string;

  /**
   * - `once` (default) to attach handler once to all elements when `rootSelector` becomes available.
   * - `watch` to attach handlers to new elements that match the selector
   * @since 1.4.7
   */
  attachMode?: AttachMode;

  /**
   * Allow the trigger to run even when the tab/frame is not active.
   *
   * NOTE: this property does not refer to running the trigger in the extension's background page. PixieBrix currently
   * only supports running mods in the context of a frame's content script.
   *
   * - Introduced in 1.5.3 and checked for interval triggers. The effective value was `true` for other triggers
   *  because this value was not checked. (However, certain triggers, e.g., 'click' can only be triggered by the user
   *  when the tab is active.)
   * - As of 1.8.7, this value is checked for all triggers. For backward compatability, for non-interval triggers,
   *  the default value if not provided is `true`.
   *
   * @since 1.5.3
   * @see getDefaultAllowInactiveFramesForTrigger
   */
  background?: boolean;

  /**
   * Flag to control if all trigger fires/errors for an extension are reported.
   *
   * If not provided, defaults based on the trigger type:
   * - User action (e.g., click): all
   * - Automatic actions: once
   *
   * @see ReportMode
   * @see USER_ACTION_TRIGGERS
   * @since 1.6.4
   */
  reportMode?: ReportMode;

  /**
   * Flag to control if errors should be shown to the end-user.
   *
   * Introduced to avoid showing errors for automatic/interval triggers, and for certain compliance use cases.
   * Prior to 1.7.34, error notifications were being swallowed: see https://github.com/pixiebrix/pixiebrix-extension/issues/2910
   *
   * @since 1.7.34
   */
  showErrors?: boolean;

  /**
   * @since 1.4.8
   */
  targetMode?: TargetMode;

  /**
   * The trigger event
   */
  trigger?: Trigger;

  /**
   * For `interval` trigger, the interval in milliseconds.
   */
  intervalMillis?: number;

  /**
   * For `custom` trigger, the custom event trigger options.
   *
   * @since 1.6.5
   */
  customEvent?: CustomEventOptions;

  /**
   * Debounce the trigger for the extension point.
   */
  debounce?: DebounceOptions;
}

class RemoteTriggerExtensionPoint extends TriggerStarterBrickABC {
  private readonly _definition: TriggerDefinition;

  public readonly permissions: Permissions.Permissions;

  public readonly rawConfig: StarterBrickDefinitionLike<TriggerDefinition>;

  public override get defaultOptions(): Record<string, string> {
    return this._definition.defaultOptions ?? {};
  }

  constructor(
    platform: PlatformProtocol,
    config: StarterBrickDefinitionLike<TriggerDefinition>,
  ) {
    // `cloneDeep` to ensure we have an isolated copy (since proxies could get revoked)
    const cloned = cloneDeep(config);
    assertNotNullish(
      cloned.metadata,
      "metadata is required to create a starter brick",
    );
    super(platform, cloned.metadata);
    this._definition = cloned.definition;
    this.rawConfig = cloned;
    const { isAvailable } = cloned.definition;
    this.permissions = {
      permissions: ["tabs", "webNavigation"],
      origins: castArray(isAvailable.matchPatterns),
    };
  }

  get debounceOptions(): DebounceOptions {
    return this._definition.debounce ?? {};
  }

  get customTriggerOptions(): CustomEventOptions | undefined {
    return this._definition.customEvent;
  }

  get trigger(): Trigger {
    return this._definition.trigger ?? "load";
  }

  get targetMode(): TargetMode {
    return this._definition.targetMode ?? "eventTarget";
  }

  get attachMode(): AttachMode {
    return this._definition.attachMode ?? "once";
  }

  get reportMode(): ReportMode {
    return (
      this._definition.reportMode ??
      getDefaultReportModeForTrigger(this.trigger)
    );
  }

  /**
   * Returns true if errors show be shown to the end-user as notifications.
   * @since 1.7.34
   */
  get showErrors(): boolean {
    return this._definition.showErrors ?? false;
  }

  get intervalMillis(): number {
    return this._definition.intervalMillis ?? 0;
  }

  get triggerSelector(): string | undefined {
    return this._definition.rootSelector;
  }

  get allowInactiveFrames(): boolean {
    return (
      this._definition.background ??
      getDefaultAllowInactiveFramesForTrigger(this.trigger)
    );
  }

  override async getBaseReader(): Promise<Reader> {
    return mergeReaders(this._definition.reader);
  }

  async isAvailable(): Promise<boolean> {
    return checkAvailable(this._definition.isAvailable);
  }
}

export function fromJS(
  platform: PlatformProtocol,
  config: StarterBrickDefinitionLike<TriggerDefinition>,
): StarterBrick {
  const { type } = config.definition;
  if (type !== "trigger") {
    throw new Error(`Expected type=trigger, got ${type}`);
  }

  return new RemoteTriggerExtensionPoint(platform, config);
}
