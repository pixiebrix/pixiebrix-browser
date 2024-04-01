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

import { renderHook } from "@/pageEditor/testHelpers";
import useUpsertModComponentFormState from "@/pageEditor/hooks/useUpsertModComponentFormState";
import { formStateFactory } from "@/testUtils/factories/pageEditorFactories";
import MockAdapter from "axios-mock-adapter";
import axios from "axios";
import { type ModComponentState } from "@/store/extensionsTypes";
import { selectActivatedModComponents } from "@/store/extensionsSelectors";

const axiosMock = new MockAdapter(axios);
const defaultOptions = {
  pushToCloud: false,
  checkPermissions: false,
  notifySuccess: true,
  reactivateEveryTab: false,
};

describe("useUpsertModComponentFormState", () => {
  let expectedUpdateDate: Date;

  beforeAll(() => {
    expectedUpdateDate = new Date("2023-01-01");
    jest.useFakeTimers().setSystemTime(expectedUpdateDate);
  });

  beforeEach(() => {
    axiosMock.onGet("/api/bricks/").reply(200, []);
  });

  afterEach(() => {
    axiosMock.reset();
  });

  it("should save form state to redux", async () => {
    const modComponent = formStateFactory();

    const { result, getReduxStore, waitForEffect } = renderHook(() =>
      useUpsertModComponentFormState(),
    );
    await waitForEffect();

    const upsertModComponentFormState = result.current;
    await upsertModComponentFormState({
      element: modComponent,
      options: defaultOptions,
    });

    const extensions = selectActivatedModComponents(
      getReduxStore().getState() as { options: ModComponentState },
    );

    expect(extensions).toHaveLength(1);
    expect(extensions[0]).toEqual(
      expect.objectContaining({
        id: modComponent.uuid,
        extensionPointId: modComponent.extensionPoint.metadata.id,
        updateTimestamp: expectedUpdateDate.toISOString(),
      }),
    );
  });

  it("pushes mod component to the cloud with the same updateTimestamp that is saved to redux", async () => {
    const modComponent = formStateFactory();

    const { result, getReduxStore, waitForEffect } = renderHook(() =>
      useUpsertModComponentFormState(),
    );
    await waitForEffect();

    const upsertModComponentFormState = result.current;
    await upsertModComponentFormState({
      element: modComponent,
      options: { ...defaultOptions, pushToCloud: true },
    });

    const extensions = selectActivatedModComponents(
      getReduxStore().getState() as { options: ModComponentState },
    );

    const expectedFields = {
      id: modComponent.uuid,
      extensionPointId: modComponent.extensionPoint.metadata.id,
      updateTimestamp: expectedUpdateDate.toISOString(),
    };

    expect(extensions).toHaveLength(1);
    expect(extensions[0]).toEqual(expect.objectContaining(expectedFields));

    expect(axiosMock.history.put).toHaveLength(1);
    expect(axiosMock.history.put[0].url).toBe(
      `/api/extensions/${modComponent.uuid}/`,
    );
    expect(JSON.parse(axiosMock.history.put[0].data)).toEqual(
      expect.objectContaining(expectedFields),
    );
  });
});
