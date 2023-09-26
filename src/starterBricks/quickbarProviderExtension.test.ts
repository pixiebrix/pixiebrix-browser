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

import { validateRegistryId } from "@/types/helpers";
import { mockAnimationsApi } from "jsdom-testing-mocks";
import { type UnknownObject } from "@/types/objectTypes";
import { define } from "cooky-cutter";
import {
  fromJS,
  type QuickBarProviderConfig,
  type QuickBarProviderDefinition,
} from "@/starterBricks/quickBarProviderExtension";
import { type BrickPipeline } from "@/bricks/types";
import {
  getDocument,
  RootReader,
  tick,
} from "@/starterBricks/starterBrickTestUtils";
import blockRegistry from "@/bricks/registry";
import userEvent from "@testing-library/user-event";
import quickBarRegistry from "@/components/quickBar/quickBarRegistry";
import { toggleQuickBar } from "@/components/quickBar/QuickBarApp";
import defaultActions from "@/components/quickBar/defaultActions";
import { waitForEffect } from "@/testUtils/testHelpers";
import { type ResolvedModComponent } from "@/types/modComponentTypes";
import { RunReason } from "@/types/runtimeTypes";

import { uuidSequence } from "@/testUtils/factories/stringFactories";
import { starterBrickConfigFactory as genericExtensionPointFactory } from "@/testUtils/factories/modDefinitionFactories";

const rootReaderId = validateRegistryId("test/root-reader");

mockAnimationsApi();
const starterBrickFactory = (definitionOverrides: UnknownObject = {}) =>
  genericExtensionPointFactory({
    definition: define<QuickBarProviderDefinition>({
      type: "quickBarProvider",
      isAvailable: () => ({
        matchPatterns: ["*://*/*"],
      }),
      reader: () => [rootReaderId],
      ...definitionOverrides,
    }),
  });

const extensionFactory = define<ResolvedModComponent<QuickBarProviderConfig>>({
  apiVersion: "v3",
  _resolvedModComponentBrand: undefined,
  id: uuidSequence,
  extensionPointId: (n: number) =>
    validateRegistryId(`test/starter-brick-${n}`),
  _recipe: null,
  label: "Test Extension",
  config: define<QuickBarProviderConfig>({
    rootAction: {
      title: "Test Root Action",
    },
    generator: () => [] as BrickPipeline,
  }),
});

const rootReader = new RootReader();

beforeAll(() => {
  const html = getDocument("<div></div>").body.innerHTML;
  document.body.innerHTML = html;
});
const NUM_DEFAULT_QUICKBAR_ACTIONS = defaultActions.length;

describe("quickBarProviderExtension", () => {
  beforeEach(() => {
    blockRegistry.clear();
    blockRegistry.register([rootReader]);
    rootReader.readCount = 0;
    rootReader.ref = undefined;
  });

  it("quick bar provider adds root action instantly", async () => {
    const user = userEvent.setup();

    const starterBrick = fromJS(starterBrickFactory());

    starterBrick.registerModComponent(
      extensionFactory({
        extensionPointId: starterBrick.id,
      })
    );

    expect(quickBarRegistry.currentActions).toHaveLength(
      NUM_DEFAULT_QUICKBAR_ACTIONS
    );
    await starterBrick.install();
    await starterBrick.runModComponents({ reason: RunReason.MANUAL });

    expect(quickBarRegistry.currentActions).toHaveLength(
      NUM_DEFAULT_QUICKBAR_ACTIONS + 1
    );

    expect(rootReader.readCount).toBe(0);

    // QuickBar installation adds another div to the body
    expect(document.body.innerHTML).toBe(
      '<div id="pixiebrix-quickbar-container"></div><div></div>'
    );

    // :shrug: I'm not sure how to get the kbar to show using shortcuts in jsdom, so just toggle manually
    await user.keyboard("[Ctrl] k");
    toggleQuickBar();

    await tick();

    // Should be showing the QuickBar portal. The innerHTML doesn't contain the QuickBar actions at this point
    // TODO: add quickbar visibility assertion

    starterBrick.uninstall();

    expect(quickBarRegistry.currentActions).toHaveLength(
      NUM_DEFAULT_QUICKBAR_ACTIONS
    );

    // Toggle off the quickbar
    toggleQuickBar();
    await waitForEffect();
  });

  it("runs the generator on query change", async () => {
    const user = userEvent.setup();

    const starterBrick = fromJS(starterBrickFactory());

    starterBrick.registerModComponent(
      extensionFactory({
        extensionPointId: starterBrick.id,
        config: {
          generator: [] as BrickPipeline,
        },
      })
    );

    await starterBrick.install();
    await starterBrick.runModComponents({ reason: RunReason.MANUAL });

    await tick();

    expect(quickBarRegistry.currentActions).toHaveLength(
      NUM_DEFAULT_QUICKBAR_ACTIONS
    );

    expect(rootReader.readCount).toBe(0);

    // QuickBar installation adds another div to the body
    expect(document.body.innerHTML).toBe(
      '<div id="pixiebrix-quickbar-container"></div><div></div>'
    );

    // :shrug: I'm not sure how to get the kbar to show using shortcuts in jsdom, so just toggle manually
    await user.keyboard("[Ctrl] k");
    toggleQuickBar();

    await tick();

    // Should be showing the QuickBar portal. The innerHTML doesn't contain the QuickBar actions at this point
    expect(document.body.innerHTML).not.toBe(
      '<div id="pixiebrix-quickbar-container"></div><div></div>'
    );

    // Getting an error here: make sure you apple `query.inputRefSetter`
    // await user.keyboard("abc");
    // Manually generate actions
    await quickBarRegistry.generateActions({
      query: "foo",
      rootActionId: undefined,
    });

    expect(rootReader.readCount).toBe(1);

    starterBrick.uninstall();

    expect(quickBarRegistry.currentActions).toHaveLength(
      NUM_DEFAULT_QUICKBAR_ACTIONS
    );

    toggleQuickBar();
    await tick();
  });

  it("includes query in the schema", async () => {
    const starterBrick = fromJS(starterBrickFactory());
    const reader = await starterBrick.defaultReader();
    expect(reader.outputSchema.properties).toHaveProperty("query");
  });

  it("includes query in preview", async () => {
    const starterBrick = fromJS(starterBrickFactory());
    const reader = await starterBrick.previewReader();
    const value = await reader.read(document);
    expect(value).toHaveProperty("query");
  });
});
