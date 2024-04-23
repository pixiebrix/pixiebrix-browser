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

import { type UUID } from "@/types/stringTypes";
import { type RegistryId } from "@/types/registryTypes";
import { cloneDeep, isEqual, merge } from "lodash";
import { BusinessError } from "@/errors/businessErrors";
import { type JsonObject } from "type-fest";
import { assertPlatformCapability } from "@/platform/platformContext";
import { assertNotNullish, type Nullishable } from "@/utils/nullishUtils";

type MergeStrategy = "shallow" | "replace" | "deep";

type StateNamespace = "blueprint" | "extension" | "shared";

const privateState = new Map<UUID, JsonObject>();

/**
 * The blueprint page state, or null for shared state
 */
const modState = new Map<RegistryId | null, JsonObject>();

function mergeState(
  previous: JsonObject,
  update: JsonObject,
  strategy: MergeStrategy,
): JsonObject {
  const cloned = cloneDeep(update);

  switch (strategy) {
    case "replace": {
      return cloned;
    }

    case "deep": {
      // `merge` mutates the first argument, so we clone it first
      return merge(cloneDeep(previous), cloned);
    }

    case "shallow": {
      return { ...previous, ...cloned };
    }

    default: {
      const exhaustiveCheck: never = strategy;
      throw new BusinessError(`Unknown merge strategy: ${exhaustiveCheck}`);
    }
  }
}

function dispatchStageChangeEventOnChange({
  previous,
  next,
  namespace,
  extensionId,
  blueprintId,
}: {
  previous: unknown;
  next: unknown;
  namespace: string;
  extensionId: Nullishable<UUID>;
  blueprintId: Nullishable<RegistryId>;
}) {
  if (!isEqual(previous, next)) {
    // For now, leave off the event data because we're using a public channel
    const detail = {
      namespace,
      extensionId,
      blueprintId,
    };

    console.debug("Dispatching statechange", detail);

    const event = new CustomEvent("statechange", { detail, bubbles: true });
    document.dispatchEvent(event);
  }
}

export function setState({
  namespace,
  data,
  mergeStrategy,
  extensionId,
  // Normalize undefined to null for lookup
  blueprintId = null,
}: {
  namespace: StateNamespace;
  data: JsonObject;
  mergeStrategy: MergeStrategy;
  extensionId: Nullishable<UUID>;
  blueprintId: Nullishable<RegistryId>;
}) {
  assertPlatformCapability("state");

  const notifyOnChange = (previous: JsonObject, next: JsonObject) => {
    dispatchStageChangeEventOnChange({
      previous,
      next,
      namespace,
      extensionId,
      blueprintId,
    });
  };

  switch (namespace) {
    case "shared": {
      const previous = modState.get(null) ?? {};
      const next = mergeState(previous, data, mergeStrategy);
      modState.set(null, next);
      notifyOnChange(previous, next);
      return next;
    }

    case "blueprint": {
      const previous = modState.get(blueprintId) ?? {};
      const next = mergeState(previous, data, mergeStrategy);
      console.log("setting blueprint state", blueprintId, next);
      modState.set(blueprintId, next);
      notifyOnChange(previous, next);
      return next;
    }

    case "extension": {
      assertNotNullish(extensionId, "Invalid context: extensionId not found");
      const previous = privateState.get(extensionId) ?? {};
      const next = mergeState(previous, data, mergeStrategy);
      privateState.set(extensionId, next);
      notifyOnChange(previous, next);
      return next;
    }

    default: {
      const exhaustiveCheck: never = namespace;
      throw new BusinessError(`Invalid namespace: ${exhaustiveCheck}`);
    }
  }
}

export function getState({
  namespace,
  extensionId,
  // Normalize undefined to null for lookup
  blueprintId = null,
}: {
  namespace: StateNamespace;
  extensionId: Nullishable<UUID>;
  blueprintId: Nullishable<RegistryId>;
}): JsonObject {
  assertPlatformCapability("state");

  switch (namespace) {
    case "shared": {
      return modState.get(null) ?? {};
    }

    case "blueprint": {
      console.log(
        "getting blueprint state",
        blueprintId,
        modState.get(blueprintId),
      );
      return modState.get(blueprintId) ?? {};
    }

    case "extension": {
      assertNotNullish(extensionId, "Invalid context: extensionId not found");
      return privateState.get(extensionId) ?? {};
    }

    default: {
      const exhaustiveCheck: never = namespace;
      throw new BusinessError(`Invalid namespace: ${exhaustiveCheck}`);
    }
  }
}

export function TEST_resetState(): void {
  privateState.clear();
  modState.clear();
}
