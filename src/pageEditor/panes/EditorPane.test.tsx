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

/* eslint jest/expect-expect: ["error", { "assertFunctionNames": ["expect", "expectEditorError"] }] */

import React from "react";
import {
  getByText,
  getByTitle,
  render,
  screen,
} from "@/pageEditor/testHelpers";
import EditorPane from "./EditorPane";
import { actions as editorActions } from "@/pageEditor/slices/editorSlice";
import { selectActiveElement } from "@/pageEditor/slices/editorSelectors";
import brickRegistry from "@/blocks/registry";
import {
  type EditorRootState,
  PipelineFlavor,
} from "@/pageEditor/pageEditorTypes";
import {
  echoBrick,
  teapotBrick,
} from "@/runtime/pipelineTests/pipelineTestHelpers";
import { defaultBlockConfig } from "@/blocks/util";
import { waitForEffect } from "@/testUtils/testHelpers";
import registerDefaultWidgets from "@/components/fields/schemaFields/widgets/registerDefaultWidgets";
import userEvent from "@testing-library/user-event";
import { JQTransformer } from "@/blocks/transformers/jq";
import { AlertEffect } from "@/blocks/effects/alert";
import ForEach from "@/blocks/transformers/controlFlow/ForEach";
import {
  makePipelineExpression,
  makeTemplateExpression,
} from "@/runtime/expressionCreators";
import { type OutputKey, type PipelineExpression } from "@/types/runtimeTypes";
import AddBlockModal from "@/components/addBlockModal/AddBlockModal";
import { type EditablePackageMetadata } from "@/types/contract";
import { fireTextInput } from "@/testUtils/formHelpers";
import { MarkdownRenderer } from "@/blocks/renderers/markdown";
import { PIPELINE_BLOCKS_FIELD_NAME } from "@/pageEditor/consts";
import getType from "@/runtime/getType";
import { type ModComponentFormState } from "@/pageEditor/extensionPoints/formStateTypes";
import { MULTIPLE_RENDERERS_ERROR_MESSAGE } from "@/analysis/analysisVisitors/renderersAnalysis";
import { RunProcess } from "@/contrib/uipath/process";
import { act } from "react-dom/test-utils";
import * as sinonTimers from "@sinonjs/fake-timers";
import { array } from "cooky-cutter";
import { appApiMock } from "@/testUtils/appApiMock";
import { mockCachedUser } from "@/testUtils/userMock";

import { uuidSequence } from "@/testUtils/factories/stringFactories";
import {
  formStateFactory,
  triggerFormStateFactory,
} from "@/testUtils/factories/pageEditorFactories";
import { brickConfigFactory } from "@/testUtils/factories/brickFactories";
import {
  marketplaceListingFactory,
  marketplaceTagFactory,
} from "@/testUtils/factories/marketplaceFactories";
import { partnerUserFactory } from "@/testUtils/factories/authFactories";

jest.setTimeout(15_000); // This test is flaky with the default timeout of 5000 ms

let clock: sinonTimers.InstalledClock;
async function tickAsyncEffects() {
  return act(async () => {
    await clock.tickAsync(1000);
  });
}

// Mock to support hook usage in the subtree, not relevant to UI tests here
jest.mock("@/hooks/useRefreshRegistries");

const jqBrick = new JQTransformer();
const alertBrick = new AlertEffect();
const forEachBrick = new ForEach();
const markdownBrick = new MarkdownRenderer();
const uiPathBrick = new RunProcess();

// Using events without delays with jest fake timers
const immediateUserEvent = userEvent.setup({ delay: null });

beforeAll(async () => {
  registerDefaultWidgets();

  brickRegistry.clear();

  brickRegistry.register([
    echoBrick,
    teapotBrick,
    jqBrick,
    alertBrick,
    forEachBrick,
    markdownBrick,
    uiPathBrick,
  ]);

  // Force block map to be created
  await brickRegistry.allTyped();

  const tags = [
    marketplaceTagFactory({ subtype: "role" }),
    marketplaceTagFactory({ subtype: "role" }),
    marketplaceTagFactory({ subtype: "role" }),
  ];

  const listings = array(marketplaceListingFactory, 10)({ tags });

  const packages = listings.map(
    (listing, index) =>
      ({
        id: uuidSequence(index),
        name: listing.id,
      } as EditablePackageMetadata)
  );

  appApiMock.onGet("/api/marketplace/tags/").reply(200, tags);
  appApiMock.onGet("/api/marketplace/listings/").reply(200, listings);
  appApiMock.onGet("/api/bricks/").reply(200, packages);

  clock = sinonTimers.install();
});

afterAll(() => {
  clock.uninstall();
});

beforeEach(() => {
  clock.reset();
});
afterEach(async () => clock.runAllAsync());

const getPlainFormState = (): ModComponentFormState =>
  formStateFactory(undefined, [
    brickConfigFactory({
      id: echoBrick.id,
      outputKey: "echoOutput" as OutputKey,
      config: defaultBlockConfig(echoBrick.inputSchema),
    }),
    brickConfigFactory({
      id: teapotBrick.id,
      outputKey: "teapotOutput" as OutputKey,
      config: defaultBlockConfig(teapotBrick.inputSchema),
    }),
  ]);

const getFormStateWithSubPipelines = (): ModComponentFormState =>
  formStateFactory(undefined, [
    brickConfigFactory({
      id: echoBrick.id,
      outputKey: "echoOutput" as OutputKey,
      config: defaultBlockConfig(echoBrick.inputSchema),
    }),
    brickConfigFactory({
      id: forEachBrick.id,
      outputKey: "forEachOutput" as OutputKey,
      config: {
        elements: makeTemplateExpression("var", "@input.elements"),
        elementKey: "element",
        body: makePipelineExpression([
          brickConfigFactory({
            id: echoBrick.id,
            outputKey: "subEchoOutput" as OutputKey,
            config: {
              message: makeTemplateExpression(
                "nunjucks",
                "iteration {{ @element }}"
              ),
            },
          }),
        ]),
      },
    }),
  ]);

async function addABlock(addButton: Element, blockName: string) {
  await immediateUserEvent.click(addButton);

  // Filter for the specified block
  await immediateUserEvent.type(
    screen.getByTestId("tag-search-input"),
    blockName
  );

  // Run the debounced search
  await tickAsyncEffects();

  // Sometimes unexpected extra results come back in the search,
  // but the exact-match result to the search string should
  // always be first in the results grid
  await immediateUserEvent.click(
    screen.getAllByRole("button", {
      name: /^Add/,
    })[0]
  );
}

describe("renders", () => {
  test("the first selected node", async () => {
    const formState = getPlainFormState();
    const { instanceId } = formState.extension.blockPipeline[0];
    const rendered = render(<EditorPane />, {
      setupRedux(dispatch) {
        dispatch(editorActions.addElement(formState));
        dispatch(editorActions.selectElement(formState.uuid));
        dispatch(editorActions.setElementActiveNodeId(instanceId));
      },
    });

    await tickAsyncEffects();

    expect(rendered.asFragment()).toMatchSnapshot();
  });

  test("an extension with sub pipeline", async () => {
    const formState = getFormStateWithSubPipelines();
    const rendered = render(<EditorPane />, {
      setupRedux(dispatch) {
        dispatch(editorActions.addElement(formState));
        dispatch(editorActions.selectElement(formState.uuid));
      },
    });

    await tickAsyncEffects();

    expect(rendered.asFragment()).toMatchSnapshot();
  });
});

describe("can add a node", () => {
  test("to root pipeline", async () => {
    const formState = getPlainFormState();
    render(
      <>
        <EditorPane />
        <AddBlockModal />
      </>,
      {
        setupRedux(dispatch) {
          dispatch(editorActions.addElement(formState));
          dispatch(editorActions.selectElement(formState.uuid));
        },
      }
    );

    await waitForEffect();

    // Hitting the last (Foundation node plus 2 bricks) Add Brick button
    const addButtons = screen.getAllByTestId(/icon-button-[\w-]+-add-brick/i, {
      exact: false,
    });
    const last = addButtons.at(-1);
    await addABlock(last, "jq - json processor");

    const nodes = screen.getAllByTestId("editor-node");
    // Nodes: Foundation, 2 initial nodes, new JQ node
    expect(nodes).toHaveLength(4);

    // Selecting the last node (that was just added)
    const newNode = nodes[3];
    expect(newNode).toHaveClass("active");
    expect(newNode).toHaveTextContent(/jq - json processor/i);
  });

  test("to an empty extension", async () => {
    const element = formStateFactory(undefined, []);
    render(
      <>
        <EditorPane />
        <AddBlockModal />
      </>,
      {
        setupRedux(dispatch) {
          dispatch(editorActions.addElement(element));
          dispatch(editorActions.selectElement(element.uuid));
        },
      }
    );

    await waitForEffect();

    const addButton = screen.getByTestId("icon-button-foundation-add-brick");
    await addABlock(addButton, "jq - json processor");

    const nodes = screen.getAllByTestId("editor-node");
    expect(nodes).toHaveLength(2);

    // Selecting the last node (that was just added)
    const newNode = nodes[1];
    expect(newNode).toHaveClass("active");
    expect(newNode).toHaveTextContent(/jq - json processor/i);
  });

  test("to sub pipeline", async () => {
    const element = getFormStateWithSubPipelines();
    const { getReduxStore } = render(
      <div>
        <EditorPane />
        <AddBlockModal />
      </div>,
      {
        setupRedux(dispatch) {
          dispatch(editorActions.addElement(element));
          dispatch(editorActions.selectElement(element.uuid));
        },
      }
    );

    await waitForEffect();

    // Adding a node at the very beginning of the sub pipeline
    const addButtonUnderSubPipelineHeader = screen.getByTestId(
      /icon-button-[\w-]+-header-add-brick/i
    );
    await addABlock(addButtonUnderSubPipelineHeader, "jq - json processor");

    // Nodes. Root: Foundation, Echo, ForEach: new JQ node, Echo
    let nodes = screen.getAllByTestId("editor-node");
    expect(nodes).toHaveLength(5);

    // Selecting the jq - JSON processor node
    const jqNode = nodes[3];
    expect(jqNode).toHaveClass("active");
    expect(jqNode).toHaveTextContent(/jq - json processor/i);

    // Adding a node in the middle of the sub pipeline, between JQ and Echo nodes
    const reduxState = getReduxStore().getState() as EditorRootState;
    const currentElement = selectActiveElement(reduxState);
    const jqNodeId = (
      currentElement.extension.blockPipeline[1].config
        .body as PipelineExpression
    ).__value__[0].instanceId;
    const addButtonInSubPipeline = screen.getByTestId(
      `icon-button-${jqNodeId}-add-brick`
    );

    // The name of the brick is "Teapot Brick", searching for "Teapot" to get a single result in the Add Brick Dialog
    await addABlock(addButtonInSubPipeline, "Teapot");
    // Nodes. Root: Foundation, Echo, ForEach: JQ node, new Teapot node, Echo
    nodes = screen.getAllByTestId("editor-node");
    expect(nodes).toHaveLength(6);

    // Selecting the Teapot node
    const teapotNode = nodes[4];
    expect(teapotNode).toHaveClass("active");
    expect(teapotNode).toHaveTextContent(/teapot brick/i);
  });
});

async function renderEditorPaneWithBasicFormState() {
  const element = getFormStateWithSubPipelines();
  const activeNodeId = element.extension.blockPipeline[0].instanceId;
  const renderResult = render(
    <div>
      <EditorPane />
      <AddBlockModal />
    </div>,
    {
      setupRedux(dispatch) {
        dispatch(editorActions.addElement(element));
        dispatch(editorActions.selectElement(element.uuid));
        dispatch(editorActions.setElementActiveNodeId(activeNodeId));
      },
    }
  );
  await waitForEffect();
  return renderResult;
}

describe("can remove a node", () => {
  test("from root pipeline", async () => {
    await renderEditorPaneWithBasicFormState();

    // Nodes are: Foundation, Echo, ForEach: [Echo]
    // Select the first Echo brick
    await immediateUserEvent.click(screen.getAllByText(/echo/i)[0]);

    // Click the remove button
    await immediateUserEvent.click(
      screen.getByTestId("icon-button-removeNode")
    );

    // Expect nodes to be: Foundation, ForEach: Echo
    const nodes = screen.getAllByTestId("editor-node");
    expect(nodes).toHaveLength(3);
    expect(nodes[1]).toHaveTextContent(/for-each loop/i);
    expect(nodes[2]).toHaveTextContent(/echo/i);
  });

  test("from sub pipeline", async () => {
    await renderEditorPaneWithBasicFormState();

    // Nodes are: Foundation, Echo, ForEach: [Echo]
    // Select the second Echo block
    await immediateUserEvent.click(screen.getAllByText(/echo brick/i)[1]);

    // Click the remove button
    await immediateUserEvent.click(
      screen.getByTestId("icon-button-removeNode")
    );

    // Expect nodes to be: Foundation, Echo, ForEach
    const nodes = screen.getAllByTestId("editor-node");
    expect(nodes).toHaveLength(3);
    expect(nodes[1]).toHaveTextContent(/echo/i);
    expect(nodes[2]).toHaveTextContent(/for-each loop/i);
  });
});

describe("can move a node up", () => {
  test("in root pipeline", async () => {
    await renderEditorPaneWithBasicFormState();

    // Nodes are: Foundation, Echo, ForEach: [Echo]
    // There should be 2 move up buttons
    const moveUpButtons = screen.getAllByTitle("Move brick higher");
    expect(moveUpButtons).toHaveLength(2);
    // First one should be disabled
    expect(moveUpButtons[0]).toBeDisabled();
    // Click the second one
    expect(moveUpButtons[1]).not.toBeDisabled();
    await immediateUserEvent.click(moveUpButtons[1]);

    // Expect nodes to now be: Foundation, ForEach: [Echo], Echo
    const nodes = screen.getAllByTestId("editor-node");
    expect(nodes).toHaveLength(4);
    expect(nodes[1]).toHaveTextContent(/for-each loop/i);
    expect(nodes[2]).toHaveTextContent(/echo/i);
    expect(nodes[3]).toHaveTextContent(/echo/i);
  });

  test("in sub pipeline", async () => {
    await renderEditorPaneWithBasicFormState();

    // Nodes are: Foundation, Echo, ForEach: [Echo]
    // There should be 5 add buttons
    const addButtons = screen.getAllByTestId(/-add-brick/i);
    expect(addButtons).toHaveLength(5);
    // Click the second-to-last one to add a brick to the sub-pipeline
    await addABlock(addButtons[3], "jq - json processor");
    // Nodes should be: Foundation, Echo, ForEach: [Echo, JQ]
    // There should be 4 move up buttons
    const moveUpButtons = screen.getAllByTitle("Move brick higher");
    expect(moveUpButtons).toHaveLength(4);
    // First one in sub-pipeline, second-to-last, should be disabled
    expect(moveUpButtons[2]).toBeDisabled();
    // Click the last one, last in sub-pipeline
    await immediateUserEvent.click(moveUpButtons[3]);
    // Expect nodes to be: Foundation, Echo, ForEach: [JQ, Echo]
    const nodes = screen.getAllByTestId("editor-node");
    expect(nodes).toHaveLength(5);
    expect(nodes[1]).toHaveTextContent(/echo/i);
    expect(nodes[2]).toHaveTextContent(/for-each loop/i);
    expect(nodes[3]).toHaveTextContent(/jq - json processor/i);
    expect(nodes[4]).toHaveTextContent(/echo/i);

    jest.useRealTimers();
  });
});

describe("can move a node down", () => {
  test("in root pipeline", async () => {
    await renderEditorPaneWithBasicFormState();

    // Nodes are: Foundation, Echo, ForEach: [Echo]
    // There should be 2 move down buttons
    const moveDownButtons = screen.getAllByTitle("Move brick lower");
    expect(moveDownButtons).toHaveLength(2);
    // Second one should be disabled
    expect(moveDownButtons[1]).toBeDisabled();
    // Click the first one
    expect(moveDownButtons[0]).not.toBeDisabled();
    await immediateUserEvent.click(moveDownButtons[0]);

    // Expect nodes to now be: Foundation, ForEach: [Echo], Echo
    const nodes = screen.getAllByTestId("editor-node");
    expect(nodes).toHaveLength(4);
    expect(nodes[1]).toHaveTextContent(/for-each loop/i);
    expect(nodes[2]).toHaveTextContent(/echo/i);
    expect(nodes[3]).toHaveTextContent(/echo/i);
  });

  test("in sub pipeline", async () => {
    await renderEditorPaneWithBasicFormState();

    // Nodes are: Foundation, Echo, ForEach: [Echo]
    // There should be 5 add buttons
    const addButtons = screen.getAllByTestId(/-add-brick/i);
    expect(addButtons).toHaveLength(5);
    // Click the second-to-last one to add a brick to the sub-pipeline
    await addABlock(addButtons[3], "jq - json processor");
    // Nodes should be: Foundation, Echo, ForEach: [Echo, JQ]
    // There should be 4 move down buttons
    const moveDownButtons = screen.getAllByTitle("Move brick lower");
    expect(moveDownButtons).toHaveLength(4);
    // Last one should be disabled
    expect(moveDownButtons[3]).toBeDisabled();
    // Click the second-to-last one, first in sub pipeline
    await immediateUserEvent.click(moveDownButtons[2]);
    // Expect nodes to be: Foundation, Echo, ForEach: [JQ, Echo]
    const nodes = screen.getAllByTestId("editor-node");
    expect(nodes).toHaveLength(5);
    expect(nodes[1]).toHaveTextContent(/echo/i);
    expect(nodes[2]).toHaveTextContent(/for-each loop/i);
    expect(nodes[3]).toHaveTextContent(/jq - json processor/i);
    expect(nodes[4]).toHaveTextContent(/echo/i);

    jest.useRealTimers();
  });
});

describe("can copy and paste a node", () => {
  test("in root pipeline", async () => {
    await renderEditorPaneWithBasicFormState();

    // Nodes are: Foundation, Echo, ForEach: [Echo]
    // Select the first Echo brick
    await immediateUserEvent.click(screen.getAllByText(/echo brick/i)[0]);

    // Click the copy button
    await immediateUserEvent.click(screen.getByTestId("icon-button-copyNode"));

    // There should be 5 paste buttons
    const pasteButtons = screen.getAllByTestId(/-paste-brick/i);
    expect(pasteButtons).toHaveLength(5);
    // Click the last one
    await immediateUserEvent.click(pasteButtons[4]);

    // Expect nodes to be: Foundation, Echo, ForEach: [Echo], Echo
    const nodes = screen.getAllByTestId("editor-node");
    expect(nodes).toHaveLength(5);
    expect(nodes[1]).toHaveTextContent(/echo/i);
    expect(nodes[2]).toHaveTextContent(/for-each loop/i);
    expect(nodes[3]).toHaveTextContent(/echo/i);
    expect(nodes[4]).toHaveTextContent(/echo/i);
  });

  test("in sub pipeline", async () => {
    await renderEditorPaneWithBasicFormState();

    // Nodes are: Foundation, Echo, ForEach: [Echo]
    // Select the first Echo brick
    await immediateUserEvent.click(screen.getAllByText(/echo brick/i)[0]);

    // Click the copy button
    await immediateUserEvent.click(screen.getByTestId("icon-button-copyNode"));

    // There should be 5 paste buttons
    const pasteButtons = screen.getAllByTestId(/-paste-brick/i);
    expect(pasteButtons).toHaveLength(5);
    // Click the second-to-last one to paste the brick inside the sub pipeline
    await immediateUserEvent.click(pasteButtons[3]);

    // Expect nodes to be: Foundation, Echo, ForEach: [Echo, Echo]
    const nodes = screen.getAllByTestId("editor-node");
    expect(nodes).toHaveLength(5);
    expect(nodes[1]).toHaveTextContent(/echo/i);
    expect(nodes[2]).toHaveTextContent(/for-each loop/i);
    expect(nodes[3]).toHaveTextContent(/echo/i);
    expect(nodes[4]).toHaveTextContent(/echo/i);
  });

  test("with sub pipelines itself", async () => {
    await renderEditorPaneWithBasicFormState();

    // Nodes are: Foundation, Echo, ForEach: [Echo]
    // Select the ForEach brick
    await immediateUserEvent.click(screen.getAllByText(/for-each loop/i)[0]);

    // Click the copy button
    await immediateUserEvent.click(screen.getByTestId("icon-button-copyNode"));

    // There should be 5 paste buttons
    const pasteButtons = screen.getAllByTestId(/-paste-brick/i);
    expect(pasteButtons).toHaveLength(5);
    // Click the last one
    await immediateUserEvent.click(pasteButtons[4]);

    // Expect nodes to be: Foundation, Echo, ForEach: [Echo], ForEach: [Echo]
    const nodes = screen.getAllByTestId("editor-node");
    expect(nodes).toHaveLength(6);
    expect(nodes[1]).toHaveTextContent(/echo/i);
    expect(nodes[2]).toHaveTextContent(/for-each loop/i);
    expect(nodes[3]).toHaveTextContent(/echo/i);
    expect(nodes[4]).toHaveTextContent(/for-each loop/i);
    expect(nodes[5]).toHaveTextContent(/echo/i);
  });
});

describe("validation", () => {
  function expectEditorError(container: HTMLElement, errorMessage: string) {
    const errorBadge = container.querySelector(
      '.active[data-testid="editor-node"] span.badge'
    );
    expect(errorBadge).toBeInTheDocument();

    expect(
      getByText(container.querySelector(".configPanel"), errorMessage)
    ).toBeInTheDocument();
  }

  test("validates string templates", async () => {
    const formState = getFormStateWithSubPipelines();
    const subEchoNode = (
      formState.extension.blockPipeline[1].config.body as PipelineExpression
    ).__value__[0];
    const rendered = render(<EditorPane />, {
      setupRedux(dispatch) {
        dispatch(editorActions.addElement(formState));
        dispatch(editorActions.selectElement(formState.uuid));
        dispatch(editorActions.setElementActiveNodeId(subEchoNode.instanceId));
      },
    });

    await tickAsyncEffects();

    // By some reason, the validation doesn't fire with userEvent.type
    fireTextInput(rendered.getByLabelText("message"), "{{!");

    // Run the timers of the Formik-Redux state synchronization and analysis
    await tickAsyncEffects();

    expectEditorError(
      rendered.container,
      "Invalid text template. Read more about text templates: https://docs.pixiebrix.com/nunjucks-templates"
    );
  });

  test("preserves validation results when switching between extensions", async () => {
    // The test adds 2 extensions.
    // It creates an input field error to one node of the extension 1,
    // then it creates a node level error on another node (adding a renderer at the beginning of the pipeline).
    // Then we select the second extension and make sure there're no error badges displayed.
    // Going back to extension 1.
    // See the 2 error badges in the Node Layout.
    // Select the Markdown node and check the error.
    // Select the Echo brick and check the error.
    const extension1 = getPlainFormState();
    const extension2 = getPlainFormState();

    // Selecting the Echo brick in the first extension
    const { instanceId: echoBlockInstanceId } =
      extension1.extension.blockPipeline[0];
    const rendered = render(
      <>
        <EditorPane />
        <AddBlockModal />
      </>,
      {
        setupRedux(dispatch) {
          dispatch(editorActions.addElement(extension1));
          dispatch(editorActions.addElement(extension2));
          dispatch(editorActions.selectElement(extension1.uuid));
          dispatch(editorActions.setElementActiveNodeId(echoBlockInstanceId));
        },
      }
    );

    await tickAsyncEffects();

    // Make invalid string template
    // This is field level error
    fireTextInput(rendered.getByLabelText("message"), "{{!");

    await tickAsyncEffects();

    // Adding a renderer in the first position in the pipeline
    // This is a node level error
    const addButtons = screen.getAllByTestId(/icon-button-[\w-]+-add-brick/i, {
      exact: false,
    });
    const addButton = addButtons.at(0);
    await addABlock(addButton, "markdown");

    // Run the timers of the Formik-Redux state synchronization and analysis
    await tickAsyncEffects();

    // Select foundation node.
    // For testing purposes we don't want a node with error to be active when we select extension1 again
    await immediateUserEvent.click(rendered.queryAllByTestId("editor-node")[0]);

    // Ensure 2 nodes have error badges
    expect(
      rendered.container.querySelectorAll(
        '[data-testid="editor-node"] span.badge'
      )
    ).toHaveLength(2);

    // Selecting another extension. Only possible with Redux
    const store = rendered.getReduxStore();
    store.dispatch(editorActions.selectElement(extension2.uuid));

    // Ensure no error is displayed
    const errorBadgesOfAnotherExtension = rendered.container.querySelectorAll(
      '[data-testid="editor-node"] span.badge'
    );
    expect(errorBadgesOfAnotherExtension).toHaveLength(0);

    // Selecting the first extension
    store.dispatch(editorActions.selectElement(extension1.uuid));

    // Run the timers of the Formik-Redux state synchronization and analysis
    await tickAsyncEffects();

    // Should show 2 error in the Node Layout
    expect(
      rendered.container.querySelectorAll(
        '[data-testid="editor-node"] span.badge'
      )
    ).toHaveLength(2);

    const editorNodes = rendered.queryAllByTestId("editor-node");

    // Selecting the markdown brick in the first extension
    await immediateUserEvent.click(editorNodes[1]);

    expectEditorError(rendered.container, "A renderer must be the last brick.");

    // Selecting the echo brick
    await immediateUserEvent.click(editorNodes[2]);

    expectEditorError(
      rendered.container,
      "Invalid text template. Read more about text templates: https://docs.pixiebrix.com/nunjucks-templates"
    );
  });

  test("validates multiple renderers on add", async () => {
    const formState = getPlainFormState();
    formState.extension.blockPipeline.push(
      brickConfigFactory({
        id: MarkdownRenderer.BLOCK_ID,
        config: {
          markdown: makeTemplateExpression("nunjucks", "test"),
        },
      })
    );
    const rendered = render(
      <>
        <EditorPane />
        <AddBlockModal />
      </>,
      {
        setupRedux(dispatch) {
          dispatch(editorActions.addElement(formState));
          dispatch(editorActions.selectElement(formState.uuid));
        },
      }
    );

    await tickAsyncEffects();

    // Hitting the second to last (Foundation node plus 2 bricks) Add Brick button
    const addButtons = screen.getAllByTestId(/icon-button-[\w-]+-add-brick/i, {
      exact: false,
    });
    const addButton = addButtons.at(0);
    await addABlock(addButton, "markdown");

    await tickAsyncEffects();

    expectEditorError(rendered.container, MULTIPLE_RENDERERS_ERROR_MESSAGE);
  });

  test("validates that renderer is the last node on move", async () => {
    const formState = getPlainFormState();
    formState.extension.blockPipeline.push(
      brickConfigFactory({
        id: MarkdownRenderer.BLOCK_ID,
        config: {
          markdown: makeTemplateExpression("nunjucks", "test"),
        },
      })
    );

    // Selecting the last node (renderer)
    const { instanceId } = formState.extension.blockPipeline[2];
    const rendered = render(<EditorPane />, {
      setupRedux(dispatch) {
        dispatch(editorActions.addElement(formState));
        dispatch(editorActions.selectElement(formState.uuid));
        dispatch(editorActions.setElementActiveNodeId(instanceId));
      },
    });

    await waitForEffect();

    const moveUpButton = getByTitle(
      rendered.container.querySelector('.active[data-testid="editor-node"]'),
      "Move brick higher"
    );

    await immediateUserEvent.click(moveUpButton);

    await tickAsyncEffects();

    expectEditorError(rendered.container, "A renderer must be the last brick.");
  });

  const disallowedBlockValidationTestCases = [
    {
      pipelineFlavor: PipelineFlavor.NoRenderer,
      formFactory: triggerFormStateFactory,
      disallowedBlock: markdownBrick,
    },
    {
      pipelineFlavor: PipelineFlavor.NoEffect,
      formFactory: formStateFactory,
      disallowedBlock: alertBrick,
    },
  ];

  test.each(disallowedBlockValidationTestCases)(
    "validates a disallowed brick in $pipelineFlavor pipeline",
    async ({ formFactory, disallowedBlock }) => {
      const formState = formFactory();
      const disallowedBlockConfig = brickConfigFactory({
        id: disallowedBlock.id,
        config: defaultBlockConfig(disallowedBlock.inputSchema),
      });

      const rendered = render(
        <>
          <EditorPane />
        </>,
        {
          setupRedux(dispatch) {
            dispatch(editorActions.addElement(formState));
            dispatch(editorActions.selectElement(formState.uuid));
            // Adding the node will invoke validation (can't add with UI because of UI validation rules)
            dispatch(
              editorActions.addNode({
                block: disallowedBlockConfig,
                pipelinePath: PIPELINE_BLOCKS_FIELD_NAME,
                pipelineIndex: 0,
              })
            );
            dispatch(
              editorActions.setElementActiveNodeId(
                disallowedBlockConfig.instanceId
              )
            );
          },
        }
      );

      await tickAsyncEffects();

      const brickType = await getType(disallowedBlock);
      expectEditorError(
        rendered.container,
        `Brick of type "${brickType}" is not allowed in this pipeline`
      );
    }
  );
});

describe("brick validation in Add Brick Modal UI", () => {
  const testCases = [
    {
      pipelineFlavor: PipelineFlavor.NoRenderer,
      formFactory: triggerFormStateFactory,
      disallowedBlockName: "markdown",
    },
    {
      pipelineFlavor: PipelineFlavor.NoEffect,
      formFactory: formStateFactory,
      disallowedBlockName: "Window Alert",
    },
  ];

  test.each(testCases)(
    "shows alert on bricks for $pipelineFlavor pipeline",
    async ({ formFactory, disallowedBlockName }) => {
      const formState = formFactory();
      render(
        <>
          <EditorPane />
          <AddBlockModal />
        </>,
        {
          setupRedux(dispatch) {
            dispatch(editorActions.addElement(formState));
            dispatch(editorActions.selectElement(formState.uuid));
          },
        }
      );

      await waitForEffect();

      const addBrickButton = screen.getByTestId(
        "icon-button-foundation-add-brick"
      );

      await immediateUserEvent.click(addBrickButton);

      // Try to find the disallowed brick and make sure it's not there
      await immediateUserEvent.type(
        screen.getByRole("dialog").querySelector('input[name="brickSearch"]'),
        disallowedBlockName
      );

      // Run the debounced search
      await tickAsyncEffects();

      // Check for the alert on hover
      const firstResult = screen.queryAllByRole("button", { name: /add/i })[0]
        .parentElement;
      await immediateUserEvent.hover(firstResult);
      expect(firstResult).toHaveTextContent("is not allowed in this pipeline");
    }
  );

  test("hides UiPath bricks for AA users", async () => {
    mockCachedUser(partnerUserFactory());
    const formState = formStateFactory();
    render(
      <>
        <EditorPane />
        <AddBlockModal />
      </>,
      {
        setupRedux(dispatch) {
          dispatch(editorActions.addElement(formState));
          dispatch(editorActions.selectElement(formState.uuid));
        },
      }
    );

    await waitForEffect();

    const addBrickButton = screen.getByTestId(
      "icon-button-foundation-add-brick"
    );

    await immediateUserEvent.click(addBrickButton);

    // Try to find the disallowed brick and make sure it's not there
    await immediateUserEvent.type(
      screen.getByRole("dialog").querySelector('input[name="brickSearch"]'),
      "uipath"
    );

    // Run the debounced search
    await tickAsyncEffects();

    const addButtons = screen.queryAllByRole("button", { name: /add/i });

    // Assert that no UiPath bricks are available
    for (const button of addButtons) {
      const brick = button.parentElement;
      expect(brick).not.toHaveTextContent("uipath");
    }
  });
});
