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

/* eslint-disable new-cap -- test methods */
import useModViewItems from "@/mods/useModViewItems";
import {
  type ActivatedModComponent,
  type ResolvedModComponent,
} from "@/types/modComponentTypes";
import extensionsSlice from "@/store/extensionsSlice";
import MockAdapter from "axios-mock-adapter";
import axios from "axios";
import { type UnavailableMod } from "@/types/modTypes";
import { selectUnavailableRecipe } from "@/mods/useMods";
import { renderHook } from "@/extensionConsole/testHelpers";
import {
  modComponentFactory,
  activatedModComponentFactory,
} from "@/testUtils/factories/modComponentFactories";
import { defaultModDefinitionFactory } from "@/testUtils/factories/modDefinitionFactories";
import { pickModDefinitionMetadata } from "@/utils/modDefinitionUtils";

const axiosMock = new MockAdapter(axios);

describe("useModViewItems", () => {
  beforeEach(() => {
    axiosMock.onGet("/api/marketplace/listings").reply(200, []);
  });

  it("creates entry for ModComponentBase", async () => {
    const modComponent = modComponentFactory() as ResolvedModComponent;

    const { waitForEffect, result } = renderHook(
      () => useModViewItems([modComponent]),
      {
        setupRedux(dispatch) {
          dispatch(
            extensionsSlice.actions.UNSAFE_setExtensions([
              modComponent as unknown as ActivatedModComponent,
            ])
          );
        },
      }
    );

    await waitForEffect();

    expect(result.current).toEqual({
      isLoading: false,
      modViewItems: [expect.toBeObject()],
    });
  });

  it("creates entry for recipe", async () => {
    const recipe = defaultModDefinitionFactory();
    const activatedModComponent = activatedModComponentFactory({
      _recipe: pickModDefinitionMetadata(recipe),
    });

    const { waitForEffect, result } = renderHook(
      () => useModViewItems([recipe]),
      {
        setupRedux(dispatch) {
          dispatch(
            extensionsSlice.actions.UNSAFE_setExtensions([
              activatedModComponent,
            ])
          );
        },
      }
    );

    await waitForEffect();

    expect(result.current).toEqual({
      isLoading: false,
      modViewItems: [expect.toBeObject()],
    });
  });

  it("creates for unavailable recipe", async () => {
    const recipe = defaultModDefinitionFactory();
    const activatedModComponent = activatedModComponentFactory({
      _recipe: pickModDefinitionMetadata(recipe),
    });

    const unavailableRecipe: UnavailableMod = selectUnavailableRecipe(
      activatedModComponent
    );

    const { waitForEffect, result } = renderHook(
      () => useModViewItems([unavailableRecipe]),
      {
        setupRedux(dispatch) {
          dispatch(
            extensionsSlice.actions.UNSAFE_setExtensions([
              activatedModComponent,
            ])
          );
        },
      }
    );

    await waitForEffect();

    expect(result.current).toEqual({
      isLoading: false,
      modViewItems: [expect.toBeObject()],
    });
  });
});
