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

import { fetch } from "@/hooks/fetch";
import {
  type Kind,
  type Package,
  PACKAGE_NAME_REGEX,
} from "@/registry/localRegistry";
import { registry } from "@/background/messenger/api";
import { groupBy } from "lodash";
import { type RegistryPackage } from "@/types/contract";
import { getErrorMessage } from "@/errors/errorHelpers";
import { type RegistryId } from "@/core";

export interface RegistryItem<T extends RegistryId = RegistryId> {
  id: T;
}

export class DoesNotExistError extends Error {
  override name = "DoesNotExistError";
  public readonly id: string;

  constructor(id: string) {
    super(`Registry item does not exist: ${id}`);
    this.id = id;
  }
}

export type RegistryChangeListener = {
  onCacheChanged: () => void;
};

/**
 * Local brick registry backed by IDB.
 */
export class Registry<
  Id extends RegistryId = RegistryId,
  Item extends RegistryItem<Id> = RegistryItem<Id>
> {
  // Use RegistryId for `cache` and `remote` because they come from the external service

  private readonly cache = new Map<RegistryId, Item>();

  /**
   * Set of ids that have been retrieved from server.
   * @private
   */
  private readonly remote: Set<RegistryId>;

  private readonly remoteResourcePath: string;

  public readonly kinds: Set<Kind>;

  private readonly deserialize: (raw: unknown) => Item;

  private listeners: RegistryChangeListener[] = [];

  constructor(
    kinds: Kind[],
    remoteResourcePath: string,
    deserialize: (raw: unknown) => Item
  ) {
    this.remote = new Set<Id>();
    this.kinds = new Set(kinds);
    this.remoteResourcePath = remoteResourcePath;
    this.deserialize = deserialize;
  }

  addListener(listener: RegistryChangeListener): void {
    this.listeners.push(listener);
  }

  removeListener(listener: RegistryChangeListener): void {
    this.listeners = this.listeners.filter((x) => x !== listener);
  }

  private notifyAll() {
    console.debug(
      "Notifying %d registry cache listener(s) for %s",
      this.listeners.length,
      [...this.kinds].join(", ")
    );

    for (const listener of this.listeners) {
      listener.onCacheChanged();
    }
  }

  async exists(id: Id): Promise<boolean> {
    return this.cache.has(id) || (await registry.find(id)) != null;
  }

  async lookup(id: Id): Promise<Item> {
    if (!id) {
      throw new Error("id is required");
    }

    const cached = this.cache.get(id);

    if (cached) {
      return cached;
    }

    // Look up in IDB
    const raw = await registry.find(id);

    if (!raw) {
      console.debug(
        `Cannot find ${id as string} in registry ${this.remoteResourcePath}`
      );
      throw new DoesNotExistError(id);
    }

    const item = this.parse(raw.config);

    if (!item) {
      console.debug("Unable to parse block", {
        config: raw.config,
      });
      throw new Error("Unable to parse block");
    }

    this.register(item);

    return item;
  }

  /**
   * @deprecated needed for header generation; will be removed in future versions
   * @see all
   */
  cached(): Item[] {
    return [...this.cache.values()];
  }

  /**
   * Reloads all brick configurations from IDB, and returns all bricks in the registry.
   * @deprecated requires all data to be parsed
   * @see cached
   */
  async all(): Promise<Item[]> {
    const parsedItems: Item[] = [];

    await Promise.allSettled(
      [...this.kinds.values()].map(async (kind) => {
        for (const raw of await registry.getKind(kind)) {
          try {
            const parsed = this.parse(raw.config);
            if (parsed) {
              parsedItems.push(parsed);
            }
          } catch {
            // NOP
          }
        }
      })
    );

    console.debug(
      "Parsed %d registry item(s) from IDB for %s",
      parsedItems.length,
      [...this.kinds].join(", ")
    );

    // Perform as single call to register so listeners are notified once
    this.register(...parsedItems);

    return this.cached();
  }

  register(...items: Item[]): void {
    let changed = false;

    for (const item of items) {
      if (item.id == null) {
        console.warn("Skipping item with no id", item);
        continue;
      }

      this.cache.set(item.id, item);
      changed = true;
    }

    if (changed) {
      this.notifyAll();
    }
  }

  private parse(raw: unknown): Item | undefined {
    try {
      return this.deserialize(raw);
    } catch (error) {
      console.warn(
        "Error de-serializing item: %s",
        getErrorMessage(error),
        raw
      );
      return undefined;
    }
  }

  /**
   * Fetch remote brick definitions.
   */
  async fetch(): Promise<void> {
    const timestamp = new Date();

    this.remote.clear();

    const data = await fetch<RegistryPackage[]>(
      `/api/${this.remoteResourcePath}/`
    );

    if (!Array.isArray(data)) {
      console.error(`Expected array from ${this.remoteResourcePath}`, data);
      throw new Error(`Expected array from ${this.remoteResourcePath}`);
    }

    const packages: Package[] = [];

    for (const item of data) {
      const [major, minor, patch] = item.metadata.version
        .split(".")
        .map((x) => Number.parseInt(x, 10));

      const match = PACKAGE_NAME_REGEX.exec(item.metadata.id);

      if (!this.kinds.has(item.kind)) {
        console.warn(
          `Item ${item.metadata?.id ?? "[[unknown]]"} has kind ${
            item.kind
          }; expected: ${[...this.kinds.values()].join(", ")}`
        );
      }

      packages.push({
        id: item.metadata.id,
        version: { major, minor, patch },
        scope: match.groups.scope,
        kind: item.kind,
        config: item,
        rawConfig: undefined,
        timestamp,
      });
    }

    // Persist in IDB
    await Promise.allSettled(
      Object.entries(groupBy(packages, (x) => x.kind)).map(
        async ([kind, kindPackages]) => {
          console.debug(
            "Syncing %d %s package(s) with IDB",
            kindPackages.length,
            kind
          );
          await registry.syncRemote(kind as Kind, kindPackages);
        }
      )
    );

    // Mark as being from the remote server
    for (const item of packages) {
      this.remote.add(item.id as RegistryId);
    }

    // Force reload of all items from IDB. To avoid hitting IDB, we could just re-register the items that were retrieved
    // locally. However, the idea of syncRemote is that it might also remove bricks that are no longer
    // available/accessible to the user.
    await this.all();
  }

  /**
   * Clear the registry cache.
   */
  clear(): void {
    this.cache.clear();
    this.notifyAll();
  }
}

export default Registry;
