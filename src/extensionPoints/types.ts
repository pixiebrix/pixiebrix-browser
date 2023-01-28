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
  type ApiVersion,
  type BlockIcon,
  type EmptyConfig,
  type IBlock,
  type IExtensionPoint,
  type IReader,
  type Logger,
  type Metadata,
  type RegistryId,
  type ResolvedExtension,
  type RunArgs,
  type Schema,
  type UUID,
} from "@/core";
import { type Availability, type ReaderConfig } from "@/blocks/types";
import { type Permissions } from "webextension-polyfill";
import { validateRegistryId } from "@/types/helpers";

export type ExtensionPointType =
  | "panel"
  | "menuItem"
  | "trigger"
  | "contextMenu"
  | "actionPanel"
  | "quickBar"
  | "quickBarProvider";

/**
 * Follows the semantics of lodash's debounce: https://lodash.com/docs/4.17.15#debounce
 */
export type DebounceOptions = {
  /**
   * The number of milliseconds to delay.
   */
  waitMillis?: number;

  /**
   * Specify invoking on the leading edge of the timeout.
   */
  leading?: boolean;

  /**
   *  Specify invoking on the trailing edge of the timeout.
   */
  trailing?: boolean;
};

/**
 * Custom options for the `custom` trigger
 * @since 1.6.5
 */
export type CustomEventOptions = {
  /**
   * The name of the event.
   */
  eventName: "string";
};

export interface ExtensionPointDefinition {
  type: ExtensionPointType;
  isAvailable: Availability;
  reader: ReaderConfig;
}

export interface ExtensionPointConfig<
  T extends ExtensionPointDefinition = ExtensionPointDefinition
> {
  apiVersion?: ApiVersion;
  metadata: Metadata;
  definition: T;
  kind: "extensionPoint";
}

export function assertExtensionPointConfig(
  maybeExtensionPointConfig: unknown
): asserts maybeExtensionPointConfig is ExtensionPointConfig {
  const errorContext = { value: maybeExtensionPointConfig };

  if (typeof maybeExtensionPointConfig !== "object") {
    console.warn("Expected extension point", errorContext);
    throw new TypeError("Expected object for ExtensionPointConfig");
  }

  const config = maybeExtensionPointConfig as Record<string, unknown>;

  if (config.kind !== "extensionPoint") {
    console.warn("Expected extension point", errorContext);
    throw new TypeError(
      "Expected kind 'extensionPoint' for ExtensionPointConfig"
    );
  }

  if (typeof config.definition !== "object") {
    console.warn("Expected extension point", errorContext);
    throw new TypeError(
      "Expected object for definition in ExtensionPointConfig"
    );
  }

  const definition = config.definition as ExtensionPointDefinition;

  if (typeof definition.isAvailable !== "object") {
    console.warn("Expected object for definition.isAvailable", errorContext);
    throw new TypeError("Invalid definition in ExtensionPointConfig");
  }
}

export abstract class ExtensionPoint<TConfig extends EmptyConfig>
  implements IExtensionPoint
{
  public readonly id: RegistryId;

  public readonly name: string;

  public readonly icon: BlockIcon;

  public readonly description: string;

  protected readonly extensions: Array<ResolvedExtension<TConfig>> = [];

  protected readonly template?: string;

  public abstract readonly inputSchema: Schema;

  protected readonly logger: Logger;

  public abstract get kind(): ExtensionPointType;

  public get syncInstall() {
    return false;
  }

  /**
   * Permissions required to use this extensions
   * https://developer.chrome.com/extensions/permission_warnings
   */
  public abstract readonly permissions: Permissions.Permissions;

  public get defaultOptions(): Record<string, unknown> {
    return {};
  }

  protected constructor(metadata: Metadata, logger: Logger) {
    this.id = validateRegistryId(metadata.id);
    this.name = metadata.name;
    this.icon = metadata.icon;
    this.description = metadata.description;
    this.logger = logger.childLogger({ extensionPointId: this.id });
  }

  /**
   * Internal method to unregister extension's triggers/observers/etc. from the page.
   *
   * When this method is called, the extensions will still be in this.extensions. The caller is responsible for
   * updating this.extensions after the call to removeExtensions
   */
  protected abstract removeExtensions(extensionIds: UUID[]): void;

  syncExtensions(extensions: Array<ResolvedExtension<TConfig>>): void {
    const before = this.extensions.map((x) => x.id);

    const updatedIds = new Set(extensions.map((x) => x.id));
    const removed = this.extensions.filter(
      (currentExtension) => !updatedIds.has(currentExtension.id)
    );
    this.removeExtensions(removed.map((x) => x.id));

    // Clear extensions and re-populate with updated extensions
    this.extensions.splice(0, this.extensions.length);
    this.extensions.push(...extensions);

    console.debug("syncExtensions for extension point %s", this.id, {
      before,
      after: extensions.map((x) => x.id),
      removed: removed.map((x) => x.id),
    });
  }

  removeExtension(extensionId: UUID) {
    this.syncExtensions(this.extensions.filter((x) => x.id !== extensionId));
  }

  addExtension(extension: ResolvedExtension<TConfig>): void {
    const index = this.extensions.findIndex((x) => x.id === extension.id);
    if (index >= 0) {
      console.warn(
        `Extension ${extension.id} already registered for the extension point ${this.id}`
      );
      // Index is guaranteed to be a number, and this.extensions is an array
      // eslint-disable-next-line security/detect-object-injection
      this.extensions[index] = extension;
    } else {
      this.extensions.push(extension);
    }
  }

  abstract defaultReader(): Promise<IReader>;

  abstract getBlocks(extension: ResolvedExtension<TConfig>): Promise<IBlock[]>;

  abstract isAvailable(): Promise<boolean>;

  abstract install(): Promise<boolean>;

  uninstall(_options?: { global?: boolean }): void {
    console.warn(`Uninstall not implemented for extension point: ${this.id}`);
  }

  abstract run(args: RunArgs): Promise<void>;
}
