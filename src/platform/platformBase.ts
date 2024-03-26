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
  type PlatformCapability,
  PlatformCapabilityNotAvailableError,
} from "@/platform/capabilities";
import type { RegistryId, SemVerString } from "@/types/registryTypes";
import type { FormDefinition } from "@/platform/forms/formTypes";
import type { UUID } from "@/types/stringTypes";
import type { Nullishable } from "@/utils/nullishUtils";
import type { SanitizedIntegrationConfig } from "@/integrations/integrationTypes";
import type { NetworkRequestConfig } from "@/types/networkTypes";
import type { RemoteResponse } from "@/types/contract";
import type { JavaScriptPayload } from "@/sandbox/messenger/api";
import type { ElementReference } from "@/types/runtimeTypes";
import type { Logger } from "@/types/loggerTypes";
import type { DebuggerProtocol } from "@/platform/platformTypes/debuggerProtocol";
import type { AudioProtocol } from "@/platform/platformTypes/audioProtocol";
import type { StateProtocol } from "@/platform/platformTypes/stateProtocol";
import type { TemplateProtocol } from "@/platform/platformTypes/templateProtocol";
import type { ContextMenuProtocol } from "@/platform/platformTypes/contextMenuProtocol";
import type { BadgeProtocol } from "@/platform/platformTypes/badgeProtocol";
import type { ToastProtocol } from "@/platform/platformTypes/toastProtocol";
import type { TextSelectionMenuProtocol } from "@/platform/platformTypes/textSelectionMenuProtocol";
import type { ShortcutSnippetMenuProtocol } from "@/platform/platformTypes/shortcutSnippetMenuProtocol";
import type { ClipboardProtocol } from "@/platform/platformTypes/clipboardProtocol";
import type { PlatformProtocol } from "@/platform/platformProtocol";
import type { PanelProtocol } from "@/platform/platformTypes/panelProtocol";
import type { QuickBarProtocol } from "@/platform/platformTypes/quickBarProtocol";

/**
 * Base protocol with no capabilities implemented.
 *
 * Override this class to implement platform capabilities.
 *
 * @since 1.8.10
 */
export class PlatformBase implements PlatformProtocol {
  readonly capabilities: readonly PlatformCapability[] = [];

  constructor(
    readonly platformName: string,
    readonly version: SemVerString,
  ) {}

  alert(_message: unknown): void {
    throw new PlatformCapabilityNotAvailableError(this.platformName, "alert");
  }

  prompt(
    _message: string | undefined,
    _default: string | undefined,
  ): string | null {
    throw new PlatformCapabilityNotAvailableError(this.platformName, "alert");
  }

  async form(
    _definition: FormDefinition,
    _controller: AbortController,
    _context: {
      componentId: UUID;
      modId?: RegistryId;
    },
  ): Promise<unknown> {
    throw new PlatformCapabilityNotAvailableError(this.platformName, "form");
  }

  async open(_url: URL): Promise<void> {
    throw new PlatformCapabilityNotAvailableError(this.platformName, "link");
  }

  async request<TData>(
    _integrationConfig: Nullishable<SanitizedIntegrationConfig>,
    _requestConfig: NetworkRequestConfig,
  ): Promise<RemoteResponse<TData>> {
    throw new PlatformCapabilityNotAvailableError(this.platformName, "http");
  }

  async runSandboxedJavascript(_args: JavaScriptPayload): Promise<unknown> {
    throw new PlatformCapabilityNotAvailableError(this.platformName, "sandbox");
  }

  async userSelectElementRefs(): Promise<ElementReference[]> {
    throw new PlatformCapabilityNotAvailableError(
      this.platformName,
      "contentScript",
    );
  }

  get logger(): Logger {
    throw new PlatformCapabilityNotAvailableError(this.platformName, "logs");
  }

  get debugger(): DebuggerProtocol {
    throw new PlatformCapabilityNotAvailableError(
      this.platformName,
      "debugger",
    );
  }

  get audio(): AudioProtocol {
    throw new PlatformCapabilityNotAvailableError(this.platformName, "audio");
  }

  get state(): StateProtocol {
    throw new PlatformCapabilityNotAvailableError(this.platformName, "state");
  }

  get templates(): TemplateProtocol {
    throw new PlatformCapabilityNotAvailableError(
      this.platformName,
      "template",
    );
  }

  get contextMenus(): ContextMenuProtocol {
    throw new PlatformCapabilityNotAvailableError(
      this.platformName,
      "contextMenu",
    );
  }

  get badge(): BadgeProtocol {
    throw new PlatformCapabilityNotAvailableError(this.platformName, "badge");
  }

  get quickBar(): QuickBarProtocol {
    throw new PlatformCapabilityNotAvailableError(
      this.platformName,
      "quickBar",
    );
  }

  get toasts(): ToastProtocol {
    throw new PlatformCapabilityNotAvailableError(this.platformName, "toast");
  }

  get panels(): PanelProtocol {
    throw new PlatformCapabilityNotAvailableError(this.platformName, "panel");
  }

  get textSelectionMenu(): TextSelectionMenuProtocol {
    throw new PlatformCapabilityNotAvailableError(
      this.platformName,
      "textSelectionMenu",
    );
  }

  get shortcutSnippetMenu(): ShortcutSnippetMenuProtocol {
    throw new PlatformCapabilityNotAvailableError(
      this.platformName,
      "shortcutSnippetMenu",
    );
  }

  get clipboard(): ClipboardProtocol {
    throw new PlatformCapabilityNotAvailableError(
      this.platformName,
      "clipboardWrite",
    );
  }
}
