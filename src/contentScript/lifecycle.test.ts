/* eslint-disable new-cap -- using exposed TEST_ methods */
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
import {
  fromJS,
  type TriggerConfig,
  type TriggerDefinition,
} from "@/starterBricks/triggerExtension";
import { validateRegistryId } from "@/types/helpers";
import { type Metadata } from "@/types/registryTypes";
import { type ActivatedModComponent } from "@/types/modComponentTypes";
import { type BrickPipeline } from "@/bricks/types";
import { RootReader, tick } from "@/starterBricks/starterBrickTestUtils";
import blockRegistry from "@/bricks/registry";
import { resolveExtensionInnerDefinitions } from "@/registry/internal";

import { uuidSequence } from "@/testUtils/factories/stringFactories";
import { type getModComponentState } from "@/store/extensionsStorage";

let starterBrickRegistry: any;
let lifecycleModule: any;

let getModComponentStateMock: jest.MockedFunctionDeep<
  typeof getModComponentState
>;

const rootReader = new RootReader();

const starterBrickConfigFactory = (definitionOverrides: UnknownObject = {}) =>
  define<StarterBrickConfig<TriggerDefinition>>({
    apiVersion: "v3",
    kind: "extensionPoint",
    metadata: (n: number) =>
      ({
        id: validateRegistryId(`test/starter-brick-${n}`),
        name: "Test Starter Brick",
      } as Metadata),
    definition: define<TriggerDefinition>({
      type: "trigger",
      background: false,
      isAvailable: () => ({
        matchPatterns: ["*://*/*"],
      }),
      reader: () => [rootReader.id],
      ...definitionOverrides,
    }),
  });

const activatedModComponentFactory = define<
  ActivatedModComponent<TriggerConfig>
>({
  apiVersion: "v3",
  id: uuidSequence,
  extensionPointId: (n: number) =>
    validateRegistryId(`test/starter-brick-${n}`),
  _recipe: null,
  label: "Test Extension",
  config: define<TriggerConfig>({
    action: () => [] as BrickPipeline,
  }),
  _unresolvedModComponentBrand: null,
  createTimestamp: new Date().toISOString(),
  updateTimestamp: new Date().toISOString(),
  active: true,
});

describe("lifecycle", () => {
  beforeEach(() => {
    jest.isolateModules(() => {
      jest.mock("@/store/extensionsStorage", () => ({
        getModComponentState: jest
          .fn()
          .mockRejectedValue(new Error("Mock not implemented")),
      }));

      lifecycleModule = require("@/contentScript/lifecycle");
      starterBrickRegistry = require("@/starterBricks/registry").default;
      getModComponentStateMock =
        require("@/store/extensionsStorage").getModComponentState;
    });

    window.document.body.innerHTML = "";
    document.body.innerHTML = "";
    blockRegistry.clear();
    blockRegistry.register([rootReader]);
    rootReader.readCount = 0;
    rootReader.ref = undefined;
  });

  it("getActiveExtensionPoints smoke test", () => {
    expect(lifecycleModule.getActiveExtensionPoints()).toEqual([]);
  });

  it("first navigation no extensions smoke test", async () => {
    getModComponentStateMock.mockResolvedValue({ extensions: [] });

    await lifecycleModule.handleNavigate();
    expect(getModComponentStateMock).toHaveBeenCalledTimes(1);

    // No navigation has occurred, so no extensions should be loaded
    await lifecycleModule.handleNavigate();
    expect(getModComponentStateMock).toHaveBeenCalledTimes(1);

    await lifecycleModule.handleNavigate();
    // Still only called once because loadPersistedExtensionsOnce is memoized
    expect(getModComponentStateMock).toHaveBeenCalledTimes(1);
  });

  it("installs persisted trigger on first run", async () => {
    const starterBrick = fromJS(
      starterBrickConfigFactory({
        trigger: "load",
      })()
    );

    starterBrickRegistry.register([starterBrick]);
    const modComponent = activatedModComponentFactory({
      extensionPointId: starterBrick.id,
    });

    getModComponentStateMock.mockResolvedValue({ extensions: [modComponent] });

    // Sanity check for the test
    expect(getModComponentStateMock).toHaveBeenCalledTimes(0);
    await lifecycleModule.handleNavigate();

    await tick();

    expect(lifecycleModule.getActiveExtensionPoints()).toEqual([starterBrick]);
  });

  it("runEditorExtension", async () => {
    const starterBrick = fromJS(
      starterBrickConfigFactory({
        trigger: "load",
      })()
    );

    const modComponent = activatedModComponentFactory({
      extensionPointId: starterBrick.id,
    });

    starterBrick.registerModComponent(
      await resolveExtensionInnerDefinitions(modComponent)
    );

    await lifecycleModule.runEditorExtension(modComponent.id, starterBrick);

    expect(lifecycleModule.getActiveExtensionPoints()).toEqual([starterBrick]);
    expect(lifecycleModule.TEST_getPersistedExtensions().size).toBe(0);
    expect(lifecycleModule.TEST_getEditorExtensions().size).toBe(1);
  });

  it("runEditorExtension removes existing", async () => {
    const starterBrick = fromJS(
      starterBrickConfigFactory({
        trigger: "load",
      })()
    );

    starterBrickRegistry.register([starterBrick]);

    const modComponent = activatedModComponentFactory({
      extensionPointId: starterBrick.id,
    });

    getModComponentStateMock.mockResolvedValue({ extensions: [modComponent] });

    // Sanity check for the test
    expect(getModComponentStateMock).toHaveBeenCalledTimes(0);
    await lifecycleModule.handleNavigate();

    await tick();

    // Ensure the persisted extension is loaded
    expect(lifecycleModule.TEST_getPersistedExtensions().size).toBe(1);
    expect(lifecycleModule.getActiveExtensionPoints()).toEqual([starterBrick]);

    starterBrick.registerModComponent(
      await resolveExtensionInnerDefinitions(modComponent)
    );

    await lifecycleModule.runEditorExtension(modComponent.id, starterBrick);

    // Still only a single starter brick
    expect(lifecycleModule.getActiveExtensionPoints()).toEqual([starterBrick]);

    expect(lifecycleModule.TEST_getPersistedExtensions().size).toBe(0);
    expect(lifecycleModule.TEST_getEditorExtensions().size).toBe(1);

    await lifecycleModule.handleNavigate({ force: true });
    await tick();

    // Persisted extension is not re-added on force-add
    expect(lifecycleModule.TEST_getPersistedExtensions().size).toBe(0);
    expect(lifecycleModule.TEST_getEditorExtensions().size).toBe(1);
  });

  it("Removes starter bricks from deactivated mods", async () => {
    const starterBrick = fromJS(
      starterBrickConfigFactory({
        trigger: "load",
      })()
    );

    starterBrickRegistry.register([starterBrick]);

    const modComponent = activatedModComponentFactory({
      extensionPointId: starterBrick.id,
    });

    getModComponentStateMock.mockResolvedValue({ extensions: [modComponent] });

    await lifecycleModule.handleNavigate();

    await tick();

    expect(lifecycleModule.getActiveExtensionPoints()).toEqual([starterBrick]);

    const updatedStarterBrick = fromJS(
      starterBrickConfigFactory({
        trigger: "initialize",
      })()
    );

    // @ts-expect-error -- There's some weirdness going on with this extensionPointFactory;
    // it's not incrementing the starter brick id, nor is allowing the id to be passed as an override
    // https://github.com/pixiebrix/pixiebrix-extension/issues/5972
    updatedStarterBrick.id = "test/updated-starter-brick";

    starterBrickRegistry.register([updatedStarterBrick]);

    const updatedModComponent = activatedModComponentFactory({
      extensionPointId: updatedStarterBrick.id,
    });

    getModComponentStateMock.mockResolvedValue({
      extensions: [updatedModComponent],
    });
    lifecycleModule.queueReactivateTab();

    await lifecycleModule.handleNavigate({ force: true });
    await tick();

    // New starter brick is installed, old starter brick is removed
    expect(lifecycleModule.TEST_getPersistedExtensions().size).toBe(1);
    expect(lifecycleModule.getActiveExtensionPoints()).toEqual([
      updatedStarterBrick,
    ]);
  });
});
