/*
 * Copyright (C) 2020 Pixie Brix, LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { IconConfig, Metadata, Schema, ServiceDependency } from "@/core";
import { ElementInfo } from "@/nativeEditor/frameworks";
import { MenuPosition } from "@/extensionPoints/menuItemExtension";
import { BlockPipeline } from "@/blocks/combinators";
import { Trigger } from "@/extensionPoints/triggerExtension";

export interface ReaderFormState {
  metadata: Metadata;
  outputSchema: Schema;
  definition: {
    /**
     * Reader type corresponding to built-in reader factory, e.g., jquery, react.
     */
    type: string | null;
    selector: string | null;
    selectors: { [field: string]: string };
  };
}

export type ElementType = "menuItem" | "trigger" | "panel";

export interface BaseFormState {
  readonly uuid: string;
  readonly type: ElementType;

  installed?: boolean;
  autoReload?: boolean;

  label: string;

  services: ServiceDependency[];

  reader: ReaderFormState;

  extensionPoint: unknown;

  extension: unknown;
}

export interface TriggerFormState extends BaseFormState {
  extensionPoint: {
    metadata: Metadata;
    definition: {
      rootSelector: string | null;
      trigger: Trigger;
      isAvailable: {
        matchPatterns: string;
        selectors: string;
      };
    };
  };

  extension: {
    action: BlockPipeline;
  };
}

export interface PanelFormState extends BaseFormState {
  containerInfo: ElementInfo;

  extensionPoint: {
    metadata: Metadata;
    definition: {
      containerSelector: string;
      position?: MenuPosition;
      template: string;
      isAvailable: {
        matchPatterns: string;
        selectors: string;
      };
    };
    traits: {
      style: {
        mode: "default" | "inherit";
      };
    };
  };

  extension: {
    heading: string;
    body: BlockPipeline;
    collapsible?: boolean;
    shadowDOM?: boolean;
  };
}

export interface ActionFormState extends BaseFormState {
  containerInfo: ElementInfo;

  extensionPoint: {
    metadata: Metadata;
    definition: {
      containerSelector: string;
      position?: MenuPosition;
      template: string;
      isAvailable: {
        matchPatterns: string;
        selectors: string;
      };
    };
    traits?: {
      style: {
        mode: "default" | "inherit";
      };
    };
  };

  extension: {
    caption: string;
    icon?: IconConfig;
    action: BlockPipeline;
  };
}

export type FormState = ActionFormState | TriggerFormState | PanelFormState;

export interface EditorState {
  inserting: ElementType | null;
  activeElement: string | null;
  error: string | null;
  dirty: Record<string, boolean>;
  knownEditable: string[];
  readonly elements: FormState[];
}

export const initialState: EditorState = {
  activeElement: null,
  error: null,
  elements: [],
  knownEditable: [],
  dirty: {},
  inserting: null,
};

export const editorSlice = createSlice({
  name: "editor",
  initialState,
  reducers: {
    toggleInsert: (state, action: PayloadAction<ElementType>) => {
      state.inserting = action.payload;
    },
    addElement: (state, action: PayloadAction<FormState>) => {
      const element = action.payload;
      state.elements.push(element);
      state.error = null;
      state.activeElement = element.uuid;
    },
    adapterError: (
      state,
      action: PayloadAction<{ uuid: string; error: unknown }>
    ) => {
      const { uuid, error } = action.payload;
      if (error instanceof Error) {
        state.error = error.message ?? "Unknown error";
      } else {
        state.error = error.toString() ?? "Unknown error";
      }
      state.activeElement = uuid;
    },
    selectInstalled: (state, actions: PayloadAction<FormState>) => {
      state.elements.push(actions.payload);
      state.error = null;
      state.activeElement = actions.payload.uuid;
    },
    selectElement: (state, action: PayloadAction<string>) => {
      if (!state.elements.find((x) => action.payload === x.uuid)) {
        throw new Error(`Unknown dynamic element: ${action.payload}`);
      }
      state.error = null;
      state.activeElement = action.payload;
    },
    markSaved: (state, action: PayloadAction<string>) => {
      const element = state.elements.find((x) => action.payload === x.uuid);
      if (!element) {
        throw new Error(`Unknown dynamic element: ${action.payload}`);
      }
      if (!element.installed) {
        state.knownEditable.push(
          element.extensionPoint.metadata.id,
          element.reader.metadata.id
        );
      }
      element.installed = true;
      state.dirty[element.uuid] = false;
    },
    updateElement: (state, action: PayloadAction<FormState>) => {
      const { uuid } = action.payload;
      const index = state.elements.findIndex((x) => x.uuid === uuid);
      if (index < 0) {
        throw new Error(`Unknown dynamic element: ${uuid}`);
      }
      // safe b/c generated from findIndex
      // eslint-disable-next-line security/detect-object-injection
      state.elements[index] = action.payload;
      state.dirty[uuid] = true;
    },
    removeElement: (state, action: PayloadAction<string>) => {
      const uuid = action.payload;
      if (state.activeElement === uuid) {
        state.activeElement = null;
      }
      state.elements.splice(
        state.elements.findIndex((x) => x.uuid === uuid),
        1
      );
      delete state.dirty[uuid];
    },
  },
});

export const actions = editorSlice.actions;
