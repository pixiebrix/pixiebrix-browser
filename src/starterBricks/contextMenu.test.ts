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

import { type UnknownObject } from "@/types/objectTypes";
import { define } from "cooky-cutter";
import { type StarterBrickConfig } from "@/starterBricks/types";
import { validateRegistryId } from "@/types/helpers";
import { type Metadata } from "@/types/registryTypes";
import { type BrickPipeline } from "@/bricks/types";
import { RootReader } from "@/starterBricks/starterBrickTestUtils";
import blockRegistry from "@/bricks/registry";
import {
  type ContextMenuConfig,
  fromJS,
  type MenuDefinition,
} from "@/starterBricks/contextMenu";
import { type ResolvedModComponent } from "@/types/modComponentTypes";

import { uuidSequence } from "@/testUtils/factories/stringFactories";

const rootReader = new RootReader();

const extensionPointFactory = (definitionOverrides: UnknownObject = {}) =>
  define<StarterBrickConfig<MenuDefinition>>({
    apiVersion: "v3",
    kind: "extensionPoint",
    metadata: (n: number) =>
      ({
        id: validateRegistryId(`test/starter-brick-${n}`),
        name: "Test Starter Brick",
      } as Metadata),
    definition: define<MenuDefinition>({
      type: "contextMenu",
      contexts: () => ["page"] as any,
      targetMode: "document",
      isAvailable: () => ({
        matchPatterns: ["*://*/*"],
      }),
      reader: () => [rootReader.id],
      ...definitionOverrides,
    }),
  });

const extensionFactory = define<ResolvedModComponent<ContextMenuConfig>>({
  apiVersion: "v3",
  _resolvedModComponentBrand: undefined,
  id: uuidSequence,
  extensionPointId: (n: number) =>
    validateRegistryId(`test/starter-brick-${n}`),
  _recipe: null,
  label: "Test Extension",
  config: define<ContextMenuConfig>({
    title: "Test Menu Item",
    action: () => [] as BrickPipeline,
  }),
});

beforeEach(() => {
  window.document.body.innerHTML = "";
  document.body.innerHTML = "";
  blockRegistry.clear();
  blockRegistry.register([rootReader]);
  rootReader.readCount = 0;
  rootReader.ref = undefined;
});

describe("contextMenuExtension", () => {
  it("should add extension", async () => {
    const starterBrick = fromJS(extensionPointFactory()());
    const modComponent = extensionFactory();
    starterBrick.addExtension(modComponent);
  });

  it("should include context menu props in schema", async () => {
    const starterBrick = fromJS(extensionPointFactory()());
    const reader = await starterBrick.defaultReader();
    expect(reader.outputSchema.properties).toHaveProperty("selectionText");
  });

  it("should include context menu props in preview", async () => {
    const starterBrick = fromJS(extensionPointFactory()());
    const reader = await starterBrick.previewReader();
    const value = await reader.read(document);
    expect(value).toHaveProperty("selectionText");
  });
});
