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
import {
  blockConfigFactory,
  formStateFactory,
  marketplaceListingFactory,
  marketplaceTagFactory,
  uuidSequence,
} from "@/testUtils/factories";
import blockRegistry from "@/blocks/registry";
import { FormState } from "@/pageEditor/pageEditorTypes";
import {
  echoBlock,
  teapotBlock,
} from "@/runtime/pipelineTests/pipelineTestHelpers";
import { defaultBlockConfig } from "@/blocks/util";
import { waitForEffect } from "@/testUtils/testHelpers";
import registerDefaultWidgets from "@/components/fields/schemaFields/widgets/registerDefaultWidgets";
import userEvent from "@testing-library/user-event";
import { JQTransformer } from "@/blocks/transformers/jq";
import ForEach from "@/blocks/transformers/controlFlow/ForEach";
import {
  makePipelineExpression,
  makeTemplateExpression,
} from "@/testUtils/expressionTestHelpers";
import { PipelineExpression } from "@/runtime/mapArgs";
import { act } from "react-dom/test-utils";
import { OutputKey, RegistryId } from "@/core";
import AddBlockModal from "@/components/addBlockModal/AddBlockModal";
import * as api from "@/services/api";
import { MarketplaceListing } from "@/types/contract";
import { EditablePackage } from "@/types/definitions";
import { fireTextInput, selectSchemaFieldType } from "@/testUtils/formHelpers";
import { PIPELINE_BLOCKS_FIELD_NAME } from "@/pageEditor/consts";
import { useAsyncIcon } from "@/components/asyncIcon";
import { faCube } from "@fortawesome/free-solid-svg-icons";
import { MarkdownRenderer } from "@/blocks/renderers/markdown";

jest.mock("@/services/api", () => ({
  appApi: {
    endpoints: {
      getMarketplaceListings: {
        useQueryState: jest.fn(),
      },
    },
  },
  useGetMarketplaceTagsQuery: jest.fn(),
  useGetMarketplaceListingsQuery: jest.fn(),
  useGetEditablePackagesQuery: jest.fn(),
  useGetRecipesQuery: jest.fn(),
  useCreateRecipeMutation: jest.fn(),
  useUpdateRecipeMutation: jest.fn(),
}));
jest.mock("@/components/asyncIcon", () => ({
  useAsyncIcon: jest.fn(),
}));

jest.setTimeout(30_000); // This test is flaky with the default timeout of 5000 ms

const jqBlock = new JQTransformer();
const forEachBlock = new ForEach();
const markdownBlock = new MarkdownRenderer();

// Using events without delays with jest fake timers
const immediateUserEvent = userEvent.setup({ delay: null });

beforeAll(async () => {
  registerDefaultWidgets();
  blockRegistry.clear();
  blockRegistry.register(
    echoBlock,
    teapotBlock,
    jqBlock,
    forEachBlock,
    markdownBlock
  );
  await blockRegistry.allTyped();

  const tags = [
    marketplaceTagFactory({ subtype: "role" }),
    marketplaceTagFactory({ subtype: "role" }),
    marketplaceTagFactory({ subtype: "role" }),
  ];
  (api.useGetMarketplaceTagsQuery as jest.Mock).mockReturnValue({
    data: tags,
    isLoading: false,
  });

  const listings: Record<RegistryId, MarketplaceListing> = {};
  const packages: EditablePackage[] = [];
  for (let i = 0; i < 10; i++) {
    const listing = marketplaceListingFactory({ tags });
    const registryId = listing.id as RegistryId;
    listings[registryId] = listing;
    packages.push({
      id: uuidSequence(i),
      name: registryId,
    });
  }

  (api.useGetMarketplaceListingsQuery as jest.Mock).mockReturnValue({
    data: listings,
    isLoading: false,
  });
  (
    api.appApi.endpoints.getMarketplaceListings.useQueryState as jest.Mock
  ).mockReturnValue({
    data: listings,
    isLoading: false,
  });
  (api.useGetEditablePackagesQuery as jest.Mock).mockReturnValue({
    data: packages,
    isLoading: false,
  });
  (api.useGetRecipesQuery as jest.Mock).mockReturnValue({
    data: [],
    isLoading: false,
  });
  (api.useCreateRecipeMutation as jest.Mock).mockReturnValue([jest.fn()]);
  (api.useUpdateRecipeMutation as jest.Mock).mockReturnValue([jest.fn()]);

  (useAsyncIcon as jest.Mock).mockReturnValue(faCube);
});

const getPlainFormState = (): FormState =>
  formStateFactory(undefined, [
    blockConfigFactory({
      id: echoBlock.id,
      outputKey: "echoOutput" as OutputKey,
      config: defaultBlockConfig(echoBlock.inputSchema),
    }),
    blockConfigFactory({
      id: teapotBlock.id,
      config: defaultBlockConfig(teapotBlock.inputSchema),
    }),
  ]);

const getFormStateWithSubPipelines = (): FormState =>
  formStateFactory(undefined, [
    blockConfigFactory({
      id: echoBlock.id,
      outputKey: "echoOutput" as OutputKey,
      config: defaultBlockConfig(echoBlock.inputSchema),
    }),
    blockConfigFactory({
      id: forEachBlock.id,
      outputKey: "forEachOutput" as OutputKey,
      config: {
        elements: makeTemplateExpression("var", "@input.elements"),
        body: makePipelineExpression([
          blockConfigFactory({
            id: echoBlock.id,
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
    screen.getByRole("dialog").querySelector('input[name="brickSearch"]'),
    blockName
  );

  // Run the debounced search
  act(() => {
    jest.runOnlyPendingTimers();
  });

  await immediateUserEvent.click(
    screen.getAllByRole("button", {
      name: /add/i,
    })[0]
  );

  // Run validation
  act(() => {
    jest.runOnlyPendingTimers();
  });
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

    await waitForEffect();

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

    await waitForEffect();

    expect(rendered.asFragment()).toMatchSnapshot();
  });
});

describe("can add a node", () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllTimers();
  });
  afterEach(() => {
    jest.runOnlyPendingTimers();
  });

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
    const reduxState = getReduxStore().getState() as any;
    const currentElement = selectActiveElement(reduxState);
    const jqNodeId = (
      currentElement.extension.blockPipeline[1].config
        .body as PipelineExpression
    ).__value__[0].instanceId;
    const addButtonInSubPipeline = screen.getByTestId(
      `icon-button-${jqNodeId}-add-brick`
    );

    // The name of the block is "Teapot Block", searching for "Teapot" to get a single result in the Add Brick Dialog
    await addABlock(addButtonInSubPipeline, "Teapot");
    // Nodes. Root: Foundation, Echo, ForEach: JQ node, new Teapot node, Echo
    nodes = screen.getAllByTestId("editor-node");
    expect(nodes).toHaveLength(6);

    // Selecting the Teapot node
    const teapotNode = nodes[4];
    expect(teapotNode).toHaveClass("active");
    expect(teapotNode).toHaveTextContent(/teapot block/i);
  });
});

describe("can remove a node", () => {
  test("from root pipeline", async () => {
    const element = getFormStateWithSubPipelines();
    render(<EditorPane />, {
      setupRedux(dispatch) {
        dispatch(editorActions.addElement(element));
        dispatch(editorActions.selectElement(element.uuid));
        dispatch(
          editorActions.setElementActiveNodeId(
            element.extension.blockPipeline[0].instanceId
          )
        );
      },
    });
    await waitForEffect();

    await immediateUserEvent.click(
      screen.getByTestId("icon-button-removeNode")
    );

    // Nodes. Root: Foundation, ForEach: Echo
    const nodes = screen.getAllByTestId("editor-node");
    expect(nodes).toHaveLength(3);
    expect(nodes[1]).toHaveTextContent(/for-each loop/i);
    expect(nodes[2]).toHaveTextContent(/echo/i);
  });

  test("from sub pipeline", async () => {
    const element = getFormStateWithSubPipelines();
    render(<EditorPane />, {
      setupRedux(dispatch) {
        dispatch(editorActions.addElement(element));
        dispatch(editorActions.selectElement(element.uuid));
        const subPipelineNodeId = (
          element.extension.blockPipeline[1].config.body as PipelineExpression
        ).__value__[0].instanceId;
        dispatch(editorActions.setElementActiveNodeId(subPipelineNodeId));
      },
    });
    await waitForEffect();

    await immediateUserEvent.click(
      screen.getByTestId("icon-button-removeNode")
    );

    // Nodes. Root: Foundation, ForEach: Echo
    const nodes = screen.getAllByTestId("editor-node");
    expect(nodes).toHaveLength(3);

    // Selecting the first node after Foundation
    expect(nodes[1]).toHaveTextContent(/echo/i);
    expect(nodes[2]).toHaveTextContent(/for-each loop/i);
  });
});

describe("validation", () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllTimers();
  });
  afterEach(() => {
    jest.runOnlyPendingTimers();
  });

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

    await waitForEffect();

    await selectSchemaFieldType(
      `${PIPELINE_BLOCKS_FIELD_NAME}.1.config.body.__value__.0.config.message`,
      "var",
      true
    );

    // By some reason, the validation doesn't fire with userEvent.type
    fireTextInput(rendered.getByLabelText("message"), "{{!");
    await waitForEffect();

    expectEditorError(
      rendered.container,
      "Invalid text template. Read more about text templates: https://docs.pixiebrix.com/nunjucks-templates"
    );
  });

  test("validates multiple renderers", async () => {
    const formState = getPlainFormState();
    formState.extension.blockPipeline.push(
      blockConfigFactory({
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

    await waitForEffect();

    // Hitting the second to last (Foundation node plus 2 bricks) Add Brick button
    const addButtons = screen.getAllByTestId(/icon-button-[\w-]+-add-brick/i, {
      exact: false,
    });
    const addButton = addButtons.at(0);
    await addABlock(addButton, "markdown");

    expectEditorError(
      rendered.container,
      "A panel can only have one renderer. There are one or more renderers configured after this brick. A renderer must be the last brick."
    );
  });

  test("validates on move that renderer is the last node", async () => {
    const formState = getPlainFormState();
    formState.extension.blockPipeline.push(
      blockConfigFactory({
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

    // This enables the Formik to re-render the form after the Element's change
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expectEditorError(rendered.container, "A renderer must be the last brick.");
  });
});
