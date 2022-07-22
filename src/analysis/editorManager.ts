/*
 * Copyright (C) 2022 PixieBrix, Inc.
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

import { selectActiveElement } from "@/pageEditor/slices/editorSelectors";
import runtimeSlice from "@/pageEditor/slices/runtimeSlice";
import { createListenerMiddleware } from "@reduxjs/toolkit";
import { ValidatorEffect } from "@/pageEditor/validation/validationTypes";
import TraceAnalysis from "./analysisVisitors/traceAnalysis";
import analysisSlice from "./analysisSlice";
import { editorSlice } from "@/pageEditor/slices/editorSlice";
import { FormState } from "@/pageEditor/pageEditorTypes";
import OutputKeyAnalysis from "./analysisVisitors/outputKeyAnalisys";

class EditorManager {
  private readonly listenerMiddleware = createListenerMiddleware();
  public get middleware() {
    return this.listenerMiddleware.middleware;
  }

  constructor() {
    this.registerTraceAnalysis();
    this.registerOutputKeyAnalysis();
  }

  // XXX: Registration of concrete analysis can be moved outside
  private registerTraceAnalysis() {
    const effect: ValidatorEffect = async (action, listenerApi) => {
      const { extensionId, records } = action.payload;
      const state = listenerApi.getState();
      const activeElement = selectActiveElement(state);
      const activeElementId = activeElement.uuid;
      if (activeElementId !== extensionId) {
        return;
      }

      const traceAnalysis = new TraceAnalysis(records);

      listenerApi.dispatch(
        analysisSlice.actions.startAnalysis({
          extensionId,
          analysisId: traceAnalysis.id,
        })
      );

      await traceAnalysis.visitRootPipeline(
        activeElement.extension.blockPipeline,
        {
          extensionType: activeElement.type,
        }
      );

      listenerApi.dispatch(
        analysisSlice.actions.finishAnalysis({
          extensionId,
          analysisId: traceAnalysis.id,
          annotations: traceAnalysis.getAnnotations(),
        })
      );
    };

    this.listenerMiddleware.startListening({
      actionCreator: runtimeSlice.actions.setExtensionTrace,
      effect,
    });
  }

  private registerOutputKeyAnalysis() {
    const effect: ValidatorEffect = async (action, listenerApi) => {
      const element: FormState = action.payload;

      const outputKeyAnalysis = new OutputKeyAnalysis();

      listenerApi.dispatch(
        analysisSlice.actions.startAnalysis({
          extensionId: element.uuid,
          analysisId: outputKeyAnalysis.id,
        })
      );

      await outputKeyAnalysis.visitRootPipeline(
        element.extension.blockPipeline,
        {
          extensionType: element.type,
        }
      );

      listenerApi.dispatch(
        analysisSlice.actions.finishAnalysis({
          extensionId: element.uuid,
          analysisId: outputKeyAnalysis.id,
          annotations: outputKeyAnalysis.getAnnotations(),
        })
      );
    };

    this.listenerMiddleware.startListening({
      actionCreator: editorSlice.actions.editElement,
      effect,
    });
  }
}

export default EditorManager;
