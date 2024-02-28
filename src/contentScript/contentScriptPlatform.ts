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

import { type PlatformProtocol } from "@/platform/platformProtocol";
import { hideNotification, showNotification } from "@/utils/notify";
import {
  clearExtensionDebugLogs,
  setToolbarBadge,
  traces,
} from "@/background/messenger/strict/api";
import { getState, setState } from "@/platform/state/stateController";
import quickBarRegistry from "@/components/quickBar/quickBarRegistry";
import { expectContext } from "@/utils/expectContext";
import type { PlatformCapability } from "@/platform/capabilities";
import { getReferenceForElement } from "@/contentScript/elementReference";
import {
  ensureContextMenu,
  openTab,
  performConfiguredRequestInBackground,
  uninstallContextMenu,
} from "@/background/messenger/api";
import { ephemeralForm } from "@/contentScript/ephemeralForm";
import { ephemeralPanel } from "@/contentScript/ephemeralPanel";
import type { ElementReference } from "@/types/runtimeTypes";
import {
  renderHandlebarsTemplate,
  renderNunjucksTemplate,
  runUserJs,
  validateNunjucksTemplate,
} from "@/sandbox/messenger/api";
import type { JsonObject } from "type-fest";
import { BusinessError } from "@/errors/businessErrors";
import { registerHandler } from "@/contentScript/contextMenus";
import { writeToClipboard } from "@/utils/clipboardUtils";
import { tooltipActionRegistry } from "@/contentScript/selectionTooltip/tooltipController";
import { commandRegistry } from "@/contentScript/commandPopover/commandController";
import BackgroundLogger from "@/telemetry/BackgroundLogger";
import * as sidebarController from "@/contentScript/sidebarController";
import { validateSemVerString } from "@/types/helpers";
import type { UUID } from "@/types/stringTypes";
import { PlatformBase } from "@/platform/platformBase";

/**
 * @file Platform definition for mods running in a content script
 * @see PlatformProtocol
 */

async function playSound(sound: string): Promise<void> {
  const audio = new Audio(browser.runtime.getURL(`audio/${sound}.mp3`));
  // NOTE: this does not wait for the sound effect to complete
  await audio.play();
}

async function userSelectElementRefs(): Promise<ElementReference[]> {
  // The picker uses `bootstrap-switch-button`, which does a `window` check on load and breaks
  // the MV3 background worker. Lazy-loading it keeps the background worker from breaking.
  const { userSelectElement } = await import(
    /* webpackChunkName: "editorContentScript" */ "@/contentScript/pageEditor/elementPicker"
  );

  const { elements } = await userSelectElement();

  return elements.map((element) => getReferenceForElement(element));
}

class ContentScriptPlatform extends PlatformBase {
  private readonly _logger = new BackgroundLogger({
    platformName: "contentScript",
  });

  constructor() {
    super(
      "contentScript",
      validateSemVerString(browser.runtime.getManifest().version),
    );
  }

  override capabilities: PlatformCapability[] = [
    "dom",
    "pageScript",
    "contentScript",
    "logs",
    "debugger",
    "alert",
    "form",
    "panel",
    "toast",
    "sandbox",
    "clipboardWrite",
    "audio",
    "quickBar",
    "selectionTooltip",
    "commandPopover",
    "contextMenu",
    "badge",
    "state",
    "link",
    "http",
    "template",
  ];

  override open = async (url: URL): Promise<void> => {
    await openTab({
      url: url.href,
    });
  };

  // Running unbound window methods throws Invocation Error
  override alert = window.alert.bind(window);
  override prompt = window.prompt.bind(window);

  override userSelectElementRefs = userSelectElementRefs;

  // Perform requests via the background so 1/ the host pages CSP doesn't conflict, and 2/ credentials aren't
  // passed to the content script
  override request = performConfiguredRequestInBackground;

  override form = ephemeralForm;

  override runSandboxedJavascript = runUserJs;

  override get templates(): PlatformProtocol["templates"] {
    return {
      async render({
        engine,
        ...payload
      }: {
        engine: "nunjucks" | "handlebars";
        template: string;
        context: JsonObject;
        autoescape: boolean;
      }): Promise<string> {
        switch (engine) {
          case "nunjucks": {
            return renderNunjucksTemplate(payload);
          }

          case "handlebars": {
            return renderHandlebarsTemplate(payload);
          }

          default: {
            const exhaustiveCheck: never = engine;
            throw new BusinessError(
              `Unsupported template engine: ${exhaustiveCheck}`,
            );
          }
        }
      },

      async validate({
        template,
      }: {
        engine: "nunjucks";
        template: string;
      }): Promise<void> {
        await validateNunjucksTemplate(template);
      },
    };
  }

  override get audio(): PlatformProtocol["audio"] {
    return {
      play: playSound,
    };
  }

  override get badge(): PlatformProtocol["badge"] {
    return {
      setText: setToolbarBadge,
    };
  }

  override get state(): PlatformProtocol["state"] {
    // Double-check already in contentScript because the calls don't go through the messenger
    expectContext("contentScript");

    return {
      getState,
      setState,
    };
  }

  override get contextMenus(): PlatformProtocol["contextMenus"] {
    expectContext("contentScript");

    return {
      async register({ handler, ...options }) {
        registerHandler(options.extensionId, handler);
        await ensureContextMenu(options);
      },
      async unregister(componentId) {
        await uninstallContextMenu({ extensionId: componentId });
      },
    };
  }

  override get logger(): PlatformProtocol["logger"] {
    return this._logger;
  }

  override get debugger(): PlatformProtocol["debugger"] {
    return {
      async clear(componentId: UUID): Promise<void> {
        await Promise.all([
          traces.clear(componentId),
          clearExtensionDebugLogs(componentId),
        ]);
      },
      traces: {
        enter: traces.addEntry,
        exit: traces.addExit,
      },
    };
  }

  override get quickBar(): PlatformProtocol["quickBar"] {
    return quickBarRegistry;
  }

  override get toasts(): PlatformProtocol["toasts"] {
    return {
      showNotification,
      hideNotification,
    };
  }

  override get selectionTooltip(): PlatformProtocol["selectionTooltip"] {
    return tooltipActionRegistry;
  }

  override get commandPopover(): PlatformProtocol["commandPopover"] {
    return commandRegistry;
  }

  override get clipboard(): PlatformProtocol["clipboard"] {
    return {
      write: writeToClipboard,
    };
  }

  override get panels(): PlatformProtocol["panels"] {
    return {
      isContainerVisible: async () => sidebarController.isSidePanelOpen(),
      unregisterExtensionPoint: sidebarController.removeExtensionPoint,
      removeComponents: sidebarController.removeExtensions,
      reservePanels: sidebarController.reservePanels,
      updateHeading: sidebarController.updateHeading,
      upsertPanel: sidebarController.upsertPanel,
      showEvent: sidebarController.sidebarShowEvents,
      showTemporary: ephemeralPanel,
    };
  }
}

/**
 * Platform for web extensions running in the content script.
 */
const contentScriptPlatform = new ContentScriptPlatform();
export default contentScriptPlatform;
