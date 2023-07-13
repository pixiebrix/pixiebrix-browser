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

import BrickTypeAnalysis from "@/analysis/analysisVisitors/brickTypeAnalysis";
import ExtensionUrlPatternAnalysis from "@/analysis/analysisVisitors/extensionUrlPatternAnalysis";
import OutputKeyAnalysis from "@/analysis/analysisVisitors/outputKeyAnalysis";
import RenderersAnalysis from "@/analysis/analysisVisitors/renderersAnalysis";
import TemplateAnalysis from "@/analysis/analysisVisitors/templateAnalysis";
import TraceAnalysis from "@/analysis/analysisVisitors/traceAnalysis";
import ReduxAnalysisManager from "@/analysis/ReduxAnalysisManager";
import { type UUID } from "@/types/stringTypes";
import { type TraceRecord } from "@/telemetry/trace";
import { isAnyOf, type PayloadAction } from "@reduxjs/toolkit";
import { type RootState } from "./pageEditorTypes";
import { actions as editorActions } from "@/pageEditor/slices/editorSlice";
import runtimeSlice from "./slices/runtimeSlice";
import RequestPermissionAnalysis from "@/analysis/analysisVisitors/requestPermissionAnalysis";
import FormBrickAnalysis from "@/analysis/analysisVisitors/formBrickAnalysis";
import { selectActiveElementTraces } from "./slices/runtimeSelectors";
import VarAnalysis from "@/analysis/analysisVisitors/varAnalysis/varAnalysis";
import analysisSlice from "@/analysis/analysisSlice";
import RegexAnalysis from "@/analysis/analysisVisitors/regexAnalysis";
import PageStateAnalysis from "@/analysis/analysisVisitors/pageStateAnalysis/pageStateAnalysis";
import CheckEventNamesAnalysis from "@/analysis/analysisVisitors/eventNameAnalysis/checkEventNamesAnalysis";
import { selectActiveElement } from "@/pageEditor/slices/editorSelectors";
import { type ModComponentFormState } from "@/pageEditor/extensionPoints/formStateTypes";
import { selectExtensions } from "@/store/extensionsSelectors";
import { extensionToFormState } from "@/pageEditor/extensionPoints/adapter";
import { getPageState } from "@/contentScript/messenger/api";
import { thisTab } from "@/pageEditor/utils";

const runtimeActions = runtimeSlice.actions;

const pageEditorAnalysisManager = new ReduxAnalysisManager();

/**
 * Returns form states for the active mod. Includes both dirty elements tracked by the page editor, and other
 * components that are active on the page.
 * @param state the Page Editor Redux State
 */
export async function selectActiveModFormStates(
  state: RootState
): Promise<ModComponentFormState[]> {
  const element = selectActiveElement(state);

  if (element?.recipe) {
    const dirtyElements = state.editor.elements.filter(
      (x) => x.recipe?.id === element.recipe.id
    );
    const dirtyIds = new Set(dirtyElements.map((x) => x.uuid));

    const extensions = selectExtensions(state);
    const otherExtensions = extensions.filter(
      (x) => x._recipe?.id === element.recipe.id && !dirtyIds.has(x.id)
    );
    const otherElements = await Promise.all(
      otherExtensions.map(async (x) => extensionToFormState(x))
    );

    return [...dirtyElements, ...otherElements];
  }

  if (element) {
    return [element];
  }

  return [];
}

// These actions will be used with every analysis so the annotation path is up-to-date
// with the node position in the pipeline
const nodeListMutationActions = [
  editorActions.addNode,
  editorActions.moveNode,
  editorActions.removeNode,
] as const;

// The order in which the analysis are registered is important.
// The first analysis registered will be the first to run.
// When multiple actions (e.g. typing) trigger analysis, the later analysis have more chances to get aborted.
// Try to put the faster analysis first, and the slower ones at the end.

pageEditorAnalysisManager.registerAnalysisEffect(
  (
    action: PayloadAction<{ extensionId: UUID; records: TraceRecord[] }>,
    state: RootState
  ) => {
    // TraceAnalysis filter the trace errors, thus
    // selecting all records here to avoid double filtering
    const records = selectActiveElementTraces(state);

    return new TraceAnalysis(records);
  },
  {
    matcher: isAnyOf(
      runtimeActions.setExtensionTrace,
      ...nodeListMutationActions
    ),
  }
);

pageEditorAnalysisManager.registerAnalysisEffect(
  () => new BrickTypeAnalysis(),
  {
    matcher: isAnyOf(...nodeListMutationActions),
  }
);

pageEditorAnalysisManager.registerAnalysisEffect(
  () => new FormBrickAnalysis(),
  {
    matcher: isAnyOf(...nodeListMutationActions),
  }
);

pageEditorAnalysisManager.registerAnalysisEffect(
  () => new RenderersAnalysis(),
  {
    matcher: isAnyOf(...nodeListMutationActions),
  }
);

pageEditorAnalysisManager.registerAnalysisEffect(() => new TemplateAnalysis(), {
  matcher: isAnyOf(editorActions.editElement, ...nodeListMutationActions),
});

pageEditorAnalysisManager.registerAnalysisEffect(
  () => new PageStateAnalysis(),
  {
    matcher: isAnyOf(editorActions.editElement, ...nodeListMutationActions),
  }
);

pageEditorAnalysisManager.registerAnalysisEffect(
  () => new ExtensionUrlPatternAnalysis(),
  {
    matcher: isAnyOf(editorActions.editElement, ...nodeListMutationActions),
  }
);

pageEditorAnalysisManager.registerAnalysisEffect(
  () => new RequestPermissionAnalysis(),
  {
    matcher: isAnyOf(editorActions.editElement, ...nodeListMutationActions),
  }
);

pageEditorAnalysisManager.registerAnalysisEffect(() => new RegexAnalysis(), {
  matcher: isAnyOf(editorActions.editElement, ...nodeListMutationActions),
});

async function varAnalysisFactory(
  action: PayloadAction<{ extensionId: UUID; records: TraceRecord[] }>,
  state: RootState
) {
  const trace = selectActiveElementTraces(state);
  const extension = selectActiveElement(state);

  const modState = await getPageState(thisTab, {
    namespace: "blueprint",
    extensionId: extension.uuid,
    blueprintId: extension.recipe?.id,
  });

  return new VarAnalysis({ trace, modState });
}

// OutputKeyAnalysis seems to be the slowest one, so we register it in the end
pageEditorAnalysisManager.registerAnalysisEffect(
  () => new OutputKeyAnalysis(),
  {
    matcher: isAnyOf(editorActions.editElement, ...nodeListMutationActions),
  }
);

// CheckEventNamesAnalysis is not the slowest, but it triggers a post-analysis action, so put toward the end
pageEditorAnalysisManager.registerAnalysisEffect(
  async (action, state: RootState) => {
    const formStates = await selectActiveModFormStates(state);
    return new CheckEventNamesAnalysis(formStates);
  },
  {
    matcher: isAnyOf(
      // Must run whenever the active element changes in order to see changes from other mod components.
      editorActions.selectElement,
      editorActions.editElement,
      ...nodeListMutationActions
    ),
  },
  {
    postAnalysisAction(analysis, extensionId, listenerApi) {
      listenerApi.dispatch(
        analysisSlice.actions.setKnownEventNames({
          extensionId,
          eventNames: analysis.knownEventNames,
        })
      );
    },
  }
);

// VarAnalysis is not the slowest, but it triggers a post-analysis action, so put toward the end
pageEditorAnalysisManager.registerAnalysisEffect(
  varAnalysisFactory,
  {
    matcher: isAnyOf(
      editorActions.showVariablePopover,
      editorActions.editElement,
      runtimeActions.setExtensionTrace,
      ...nodeListMutationActions
    ),
  },
  {
    postAnalysisAction(analysis, extensionId, listenerApi) {
      listenerApi.dispatch(
        analysisSlice.actions.setKnownVars({
          extensionId,
          vars: analysis.getKnownVars(),
        })
      );
    },
  }
);

export default pageEditorAnalysisManager;
