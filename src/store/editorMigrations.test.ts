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
  type EditorStateV1,
  type EditorStateV2,
} from "@/pageEditor/pageEditorTypes";
import { mapValues, omit } from "lodash";
import { formStateFactory } from "@/testUtils/factories/pageEditorFactories";
import {
  type IntegrationDependencyV1,
  type IntegrationDependencyV2,
} from "@/integrations/integrationTypes";
import { integrationDependencyFactory } from "@/testUtils/factories/integrationFactories";
import { uuidSequence } from "@/testUtils/factories/stringFactories";
import { modMetadataFactory } from "@/testUtils/factories/modComponentFactories";
import { validateRegistryId } from "@/types/helpers";
import {
  type BaseFormStateV1,
  type BaseFormStateV2,
} from "@/pageEditor/baseFormStateTypes";
import { type PersistedState } from "redux-persist";
import { migrateEditorStateV1 } from "@/store/editorMigrations";

const initialState: EditorStateV1 = {
  selectionSeq: 0,
  activeElementId: null,
  activeRecipeId: null,
  expandedRecipeId: null,
  error: null,
  beta: false,
  elements: [],
  knownEditable: [],
  dirty: {},
  isBetaUI: false,
  elementUIStates: {},
  dirtyRecipeOptionsById: {},
  dirtyRecipeMetadataById: {},
  visibleModalKey: null,
  keepLocalCopyOnCreateRecipe: false,
  deletedElementsByRecipeId: {},
  availableInstalledIds: [],
  isPendingInstalledExtensions: false,
  availableDynamicIds: [],
  isPendingDynamicExtensions: false,
  isModListExpanded: true,
  isDataPanelExpanded: true,
  isDimensionsWarningDismissed: false,

  // Not persisted
  inserting: null,
  isVariablePopoverVisible: false,
};

const initialStateV1: EditorStateV1 & PersistedState = {
  ...initialState,
  _persist: {
    version: 1,
    rehydrated: false,
  },
};
const initialStateV2: EditorStateV2 & PersistedState = {
  ...omit(initialState, "elements", "deletedElementsByRecipeId"),
  elements: [],
  deletedElementsByRecipeId: {},
  // Function under test does not handle updating the persistence, this is handled by redux-persist
  _persist: {
    version: 1,
    rehydrated: false,
  },
};

describe("migrateEditorStateV1", () => {
  it("migrates empty state", () => {
    expect(migrateEditorStateV1(initialStateV1)).toStrictEqual(initialStateV2);
  });

  function unmigrateServices(
    integrationDependencies: IntegrationDependencyV2[] = [],
  ): IntegrationDependencyV1[] {
    return integrationDependencies.map(
      ({ integrationId, outputKey, configId, isOptional, apiVersion }) => ({
        id: integrationId,
        outputKey,
        config: configId,
        isOptional,
        apiVersion,
      }),
    );
  }

  function unmigrateFormState(formState: BaseFormStateV2): BaseFormStateV1 {
    return {
      ...omit(formState, "integrationDependencies"),
      services: unmigrateServices(formState.integrationDependencies),
    };
  }

  function unmigrateDeletedElements(
    deletedElements: Record<string, BaseFormStateV2[]>,
  ): Record<string, BaseFormStateV1[]> {
    return mapValues(deletedElements, (formStates) =>
      formStates.map((formState) => unmigrateFormState(formState)),
    );
  }

  function unmigrateEditorStateV2(
    state: EditorStateV2 & PersistedState,
  ): EditorStateV1 & PersistedState {
    return {
      ...omit(state, "elements", "deletedElementsByRecipeId"),
      elements: state.elements.map((element) => unmigrateFormState(element)),
      deletedElementsByRecipeId: unmigrateDeletedElements(
        state.deletedElementsByRecipeId,
      ),
    };
  }

  it("migrates state with elements with no services", () => {
    const expectedState = {
      ...initialStateV2,
      elements: [formStateFactory(), formStateFactory()],
    };
    const unmigrated = unmigrateEditorStateV2(expectedState);
    expect(migrateEditorStateV1(unmigrated)).toStrictEqual(expectedState);
  });

  it("migrates state with elements with services and deleted elements", () => {
    const fooElement1 = formStateFactory({
      recipe: modMetadataFactory({
        id: validateRegistryId("foo"),
      }),
      integrationDependencies: [
        integrationDependencyFactory({
          configId: uuidSequence,
        }),
        integrationDependencyFactory({
          configId: uuidSequence,
        }),
      ],
    });
    const fooElement2 = formStateFactory({
      recipe: modMetadataFactory({
        id: validateRegistryId("foo"),
      }),
      integrationDependencies: [
        integrationDependencyFactory({
          configId: uuidSequence,
        }),
        integrationDependencyFactory({
          configId: uuidSequence,
        }),
      ],
    });
    const barElement = formStateFactory({
      recipe: modMetadataFactory({
        id: validateRegistryId("bar"),
      }),
      integrationDependencies: [
        integrationDependencyFactory({
          configId: uuidSequence,
        }),
        integrationDependencyFactory({
          configId: uuidSequence,
        }),
      ],
    });
    const expectedState = {
      ...initialStateV2,
      elements: [
        formStateFactory({
          integrationDependencies: [
            integrationDependencyFactory({
              configId: uuidSequence,
            }),
          ],
        }),
        fooElement1,
        fooElement2,
        barElement,
      ],
      deletedElementsByRecipeId: {
        foo: [fooElement1, fooElement2],
        bar: [barElement],
      },
    };
    const unmigrated = unmigrateEditorStateV2(expectedState);
    expect(migrateEditorStateV1(unmigrated)).toStrictEqual(expectedState);
  });
});
