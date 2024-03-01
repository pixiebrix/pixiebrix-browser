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

import useBuildAndValidateMod from "@/pageEditor/hooks/useBuildAndValidateMod";
import { ADAPTERS } from "@/pageEditor/starterBricks/adapter";
import {
  internalStarterBrickMetaFactory,
  lookupExtensionPoint,
} from "@/pageEditor/starterBricks/base";
import { type ModComponentFormState } from "@/pageEditor/starterBricks/formStateTypes";
import { renderHook } from "@/pageEditor/testHelpers";
import { act } from "@testing-library/react-hooks";
import {
  type StarterBrickConfig,
  type StarterBrickDefinition,
} from "@/starterBricks/types";
import extensionsSlice, {
  actions as extensionsActions,
} from "@/store/extensionsSlice";
import {
  modComponentDefinitionFactory,
  modDefinitionFactory,
  versionedModDefinitionWithResolvedModComponents,
} from "@/testUtils/factories/modDefinitionFactories";
import { type UnsavedModDefinition } from "@/types/modDefinitionTypes";
import produce from "immer";
import { type Draft } from "immer";
import { type ModComponentState } from "@/store/extensionsTypes";
import { modMetadataFactory } from "@/testUtils/factories/modComponentFactories";
import { array } from "cooky-cutter";
import { formStateFactory } from "@/testUtils/factories/pageEditorFactories";
import { actions as editorActions } from "@/pageEditor/slices/editorSlice";

jest.mock("@/pageEditor/starterBricks/base", () => ({
  ...jest.requireActual("@/pageEditor/starterBricks/base"),
  lookupExtensionPoint: jest.fn(),
}));

describe("useBuildAndValidateMod", () => {
  function selectExtensionPoints(
    modDefinition: UnsavedModDefinition,
  ): StarterBrickConfig[] {
    return modDefinition.extensionPoints.map(({ id }) => {
      const definition = modDefinition.definitions[id]
        .definition as StarterBrickDefinition;
      return {
        apiVersion: modDefinition.apiVersion,
        metadata: internalStarterBrickMetaFactory(),
        definition,
        kind: "extensionPoint",
      };
    });
  }

  it.each`
    cleanModComponentCount | dirtyModComponentCount
    ${1}                   | ${0}
    ${2}                   | ${0}
    ${3}                   | ${0}
    ${0}                   | ${1}
    ${0}                   | ${2}
    ${0}                   | ${3}
    ${1}                   | ${1}
    ${2}                   | ${1}
    ${1}                   | ${2}
    ${2}                   | ${2}
  `(
    "mod with $cleanModComponentCount clean, and $dirtyModComponentCount changed/dirty mod components",
    async ({
      cleanModComponentCount,
      dirtyModComponentCount,
    }: {
      cleanModComponentCount: number;
      dirtyModComponentCount: number;
    }) => {
      const totalModComponentCount =
        cleanModComponentCount + dirtyModComponentCount;

      // Create a mod
      const modDefinition = versionedModDefinitionWithResolvedModComponents(
        totalModComponentCount,
      )();

      // Install the mod
      const state = extensionsSlice.reducer(
        { extensions: [] },
        extensionsActions.installMod({
          modDefinition,
          screen: "pageEditor",
          isReinstall: false,
        }),
      );

      // Collect the dirty form states for any changed mod components
      const modComponentFormStates: ModComponentFormState[] = [];

      if (dirtyModComponentCount > 0) {
        const extensionPoints = selectExtensionPoints(modDefinition);

        for (let i = 0; i < dirtyModComponentCount; i++) {
          const extensionPoint = extensionPoints[i];
          // Mock this lookup for the adapter call that follows
          jest.mocked(lookupExtensionPoint).mockResolvedValue(extensionPoint);

          // Mod was installed, so get the mod component from state
          const modComponent = state.extensions[i];

          // Load the adapter for this mod component
          const adapter = ADAPTERS.get(extensionPoint.definition.type);

          // Use the adapter to convert to FormState
          // eslint-disable-next-line no-await-in-loop -- This is much easier to read than a large Promise.all() block
          const modComponentFormState = (await adapter.fromExtension(
            modComponent,
          )) as ModComponentFormState;

          // Edit the label
          modComponentFormState.label = `New Label ${i}`;

          modComponentFormStates.push(modComponentFormState);
        }
      }

      const { result } = renderHook(() => useBuildAndValidateMod(), {
        setupRedux(dispatch) {
          dispatch(
            extensionsActions.installMod({
              modDefinition,
              screen: "pageEditor",
              isReinstall: false,
            }),
          );
        },
      });

      await act(async () => {
        const newMod = await result.current.buildAndValidateMod({
          sourceMod: modDefinition,
          // Only pass in the unchanged clean mod components
          cleanModComponents: state.extensions.slice(dirtyModComponentCount),
          dirtyModComponentFormStates: modComponentFormStates,
        });

        // Update the source mod with the expected label changes
        const updatedMod = produce(modDefinition, (draft) => {
          for (const [index, extensionPoint] of draft.extensionPoints
            .slice(0, dirtyModComponentCount)
            .entries()) {
            extensionPoint.label = `New Label ${index}`;
          }
        });

        // Compare results
        expect(newMod).toStrictEqual(updatedMod);
      });
    },
  );

  it("built mod has the wrong number of mod components", async () => {
    const modMetadata = modMetadataFactory();
    const installedModDefinition = modDefinitionFactory({
      metadata: modMetadata,
      extensionPoints: array(modComponentDefinitionFactory, 1),
    });

    const dirtyFormState1 = formStateFactory({
      recipe: modMetadata,
    });

    const { result, getReduxStore } = renderHook(
      () => useBuildAndValidateMod(),
      {
        setupRedux(dispatch) {
          dispatch(
            extensionsActions.installMod({
              modDefinition: installedModDefinition,
              screen: "pageEditor",
              isReinstall: false,
            }),
          );
          dispatch(editorActions.addElement(dirtyFormState1));
        },
      },
    );

    const state = getReduxStore().getState().options as ModComponentState;

    await act(async () => {
      await expect(
        result.current.buildAndValidateMod({
          sourceMod: installedModDefinition,
          cleanModComponents: state.extensions.slice(1),
          dirtyModComponentFormStates: [dirtyFormState1],
        }),
      ).rejects.toThrow("Mod save failed due to data integrity error");
    });
  });
});
