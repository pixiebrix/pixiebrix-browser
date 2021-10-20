/*
 * Copyright (C) 2021 PixieBrix, Inc.
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

import React, { useCallback, useMemo, useState } from "react";
import { Col, Tab } from "react-bootstrap";
import EditorNodeLayout, {
  FOUNDATION_NODE_ID,
  NodeId,
} from "@/devTools/editor/tabs/editTab/editorNodeLayout/EditorNodeLayout";
import { useFormikContext } from "formik";
import { BlockConfig } from "@/blocks/types";
import { ADAPTERS } from "@/devTools/editor/extensionPoints/adapter";
import { BlockType, defaultBlockConfig, getType } from "@/blocks/util";
import { useAsyncState } from "@/hooks/common";
import blockRegistry from "@/blocks/registry";
import { compact, isEmpty } from "lodash";
import { IBlock, OutputKey, UUID } from "@/core";
import { produce } from "immer";
import EditorNodeConfigPanel from "@/devTools/editor/tabs/editTab/editorNodeConfigPanel/EditorNodeConfigPanel";
import styles from "./EditTab.module.scss";
import { uuidv4 } from "@/types/helpers";
import { FormState } from "@/devTools/editor/slices/editorSlice";
import { generateFreshOutputKey } from "@/devTools/editor/tabs/editTab/editHelpers";
import FormTheme, { ThemeProps } from "@/components/form/FormTheme";
import ErrorBoundary from "@/components/ErrorBoundary";
import BrickIcon from "@/components/BrickIcon";
import { isNullOrBlank } from "@/utils";
import ConnectedFieldTemplate from "@/components/form/ConnectedFieldTemplate";
import DataPanel from "@/devTools/editor/tabs/editTab/dataPanel/DataPanel";
import { isInnerExtensionPoint } from "@/devTools/editor/extensionPoints/base";
import { getExampleBlockConfig } from "@/devTools/editor/tabs/editTab/exampleBlockConfigs";
import useExtensionTrace from "@/devTools/editor/hooks/useExtensionTrace";
import FoundationDataPanel from "@/devTools/editor/tabs/editTab/dataPanel/FoundationDataPanel";
import { produceExcludeUnusedDependencies } from "@/components/fields/schemaFields/ServiceField";
import usePipelineField, {
  PIPELINE_BLOCKS_FIELD_NAME,
} from "@/devTools/editor/hooks/usePipelineField";
import { BlocksMap } from "./editTabTypes";
import { EditorNodeProps } from "@/devTools/editor/tabs/editTab/editorNode/EditorNode";

const blockConfigTheme: ThemeProps = {
  layout: "horizontal",
};

const EditTab: React.FC<{
  eventKey: string;
}> = ({ eventKey }) => {
  useExtensionTrace();

  const { values, setValues: setFormValues } = useFormikContext<FormState>();
  const { extensionPoint, type: elementType } = values;

  // For now, don't allow modifying extensionPoint packages via the Page Editor.
  const isLocked = useMemo(
    () => !isInnerExtensionPoint(extensionPoint.metadata.id),
    [extensionPoint.metadata.id]
  );

  const { label, icon, EditorNode: FoundationNode } = ADAPTERS.get(elementType);

  // Load once
  const [allBlocks] = useAsyncState<BlocksMap>(
    async () => {
      const blocksMap: BlocksMap = {};
      const blocks = await blockRegistry.all();
      for (const block of blocks) {
        blocksMap[block.id] = {
          block,
          // eslint-disable-next-line no-await-in-loop
          type: await getType(block),
        };
      }

      return blocksMap;
    },
    [],
    {}
  );

  const {
    blockPipeline,
    blockPipelineErrors,
    errorTraceEntry,
  } = usePipelineField(allBlocks, elementType);

  const [activeNodeId, setActiveNodeId] = useState<NodeId>(FOUNDATION_NODE_ID);
  const activeBlockIndex = useMemo(() => {
    if (activeNodeId === FOUNDATION_NODE_ID) {
      return 0;
    }

    return blockPipeline.findIndex(
      (block) => block.instanceId === activeNodeId
    );
  }, [activeNodeId, blockPipeline]);

  const blockFieldName = `${PIPELINE_BLOCKS_FIELD_NAME}[${activeBlockIndex}]`;

  const [showAppendNode] = useAsyncState(
    async () => {
      if (isEmpty(allBlocks) || isEmpty(blockPipeline)) {
        return true;
      }

      const lastId = blockPipeline[blockPipeline.length - 1].id;
      // eslint-disable-next-line security/detect-object-injection
      const lastBlock = allBlocks[lastId];
      if (!lastBlock?.block) {
        return true;
      }

      return lastBlock.type !== "renderer";
    },
    [allBlocks, blockPipeline],
    false
  );

  const addBlock = useCallback(
    async (block: IBlock, beforeInstanceId?: UUID) => {
      const insertIndex = beforeInstanceId
        ? blockPipeline.findIndex((x) => x.instanceId === beforeInstanceId)
        : blockPipeline.length;
      const outputKey = await generateFreshOutputKey(
        block,
        compact([
          "input" as OutputKey,
          ...blockPipeline.map((x) => x.outputKey),
        ])
      );
      const newBlock: BlockConfig = {
        id: block.id,
        instanceId: uuidv4(),
        config:
          getExampleBlockConfig(block) ?? defaultBlockConfig(block.inputSchema),
      };
      if (outputKey) {
        newBlock.outputKey = outputKey;
      }

      const nextState = produce(values, (draft) => {
        draft.extension.blockPipeline.splice(insertIndex, 0, newBlock);
      });
      setFormValues(nextState);
      setActiveNodeId(newBlock.instanceId);
    },
    [blockPipeline, values, setFormValues]
  );

  const removeBlock = (nodeIdToRemove: NodeId) => {
    let prevNodeId: NodeId;
    let nextState = produce(values, (draft) => {
      const index = draft.extension.blockPipeline.findIndex(
        (block) => block.instanceId === nodeIdToRemove
      );
      if (index === 0) {
        prevNodeId = FOUNDATION_NODE_ID;
      } else {
        prevNodeId = draft.extension.blockPipeline[index - 1].instanceId;
      }

      draft.extension.blockPipeline.splice(index, 1);
    });

    nextState = produceExcludeUnusedDependencies(nextState);

    // Set the active node before setting the form values, otherwise there's a race condition based on the React state
    // causing a re-render vs. the Formik state causing a re-render
    if (activeNodeId === nodeIdToRemove) {
      setActiveNodeId(prevNodeId);
    }

    setFormValues(nextState);
  };

  function moveBlockUp(instanceId: UUID) {
    const index = blockPipeline.findIndex(
      (block) => block.instanceId === instanceId
    );
    if (index < 1 || index + 1 > blockPipeline.length) {
      return;
    }

    const nextState = produce(values, (draft) => {
      const pipeline = draft.extension.blockPipeline;
      // Swap the prev and current index values in the pipeline array, "up" in
      //  the UI means a lower index in the array
      // eslint-disable-next-line security/detect-object-injection -- from findIndex()
      [pipeline[index - 1], pipeline[index]] = [
        // eslint-disable-next-line security/detect-object-injection -- from findIndex()
        pipeline[index],
        pipeline[index - 1],
      ];
    });
    setFormValues(nextState);
  }

  function moveBlockDown(instanceId: UUID) {
    const index = blockPipeline.findIndex(
      (block) => block.instanceId === instanceId
    );
    if (index + 1 === blockPipeline.length) {
      return;
    }

    const nextState = produce(values, (draft) => {
      const pipeline = draft.extension.blockPipeline;
      // Swap the current and next index values in the pipeline array, "down"
      //  in the UI means a higher index in the array
      // eslint-disable-next-line security/detect-object-injection -- from findIndex()
      [pipeline[index], pipeline[index + 1]] = [
        pipeline[index + 1],
        // eslint-disable-next-line security/detect-object-injection -- from findIndex()
        pipeline[index],
      ];
    });
    setFormValues(nextState);
  }

  const blockNodes: EditorNodeProps[] = blockPipeline.map(
    (blockConfig, index) => {
      const block = allBlocks[blockConfig.id]?.block;
      const nodeId = blockConfig.instanceId;

      if (!block) {
        return {
          nodeId,
          title: "Loading...",
        };
      }

      const newBlock: EditorNodeProps = {
        nodeId,
        title: isNullOrBlank(blockConfig.label)
          ? block?.name
          : blockConfig.label,
        icon: (
          <BrickIcon
            brick={block}
            size="2x"
            // This makes brick icons that use basic font awesome icons
            //   inherit the editor node layout color scheme.
            // Customized SVG icons are unaffected and keep their branded
            //   color schemes.
            faIconClass={styles.brickFaIcon}
          />
        ),
        hasError:
          // If blockPipelineErrors is a string, it means the error is on the pipeline level
          typeof blockPipelineErrors !== "string" &&
          // eslint-disable-next-line security/detect-object-injection
          Boolean(blockPipelineErrors?.[index]),
        hasWarning: errorTraceEntry?.blockInstanceId === blockConfig.instanceId,
        onClick: () => {
          setActiveNodeId(blockConfig.instanceId);
        },
      };

      if (blockConfig.outputKey) {
        newBlock.outputKey = blockConfig.outputKey;
      }

      return newBlock;
    }
  );

  const foundationNode: EditorNodeProps = {
    nodeId: FOUNDATION_NODE_ID,
    outputKey: "input",
    title: label,
    icon,
    onClick: () => {
      setActiveNodeId(FOUNDATION_NODE_ID);
    },
  };

  const nodes: EditorNodeProps[] = [foundationNode, ...blockNodes];

  const [relevantBlocksToAdd] = useAsyncState(async () => {
    const excludeType: BlockType = ["actionPanel", "panel"].includes(
      elementType
    )
      ? "effect"
      : "renderer";

    return Object.values(allBlocks)
      .filter(({ type }) => type != null && type !== excludeType)
      .map(({ block }) => block);
  }, [allBlocks, elementType]);

  const blockError: string =
    // eslint-disable-next-line security/detect-object-injection
    typeof blockPipelineErrors?.[activeBlockIndex] === "string"
      ? // eslint-disable-next-line security/detect-object-injection
        (blockPipelineErrors[activeBlockIndex] as string)
      : null;

  return (
    <Tab.Pane eventKey={eventKey} className={styles.tabPane}>
      <div className={styles.paneContent}>
        <div className={styles.nodeLayout}>
          <EditorNodeLayout
            nodes={nodes}
            activeNodeId={activeNodeId}
            relevantBlocksToAdd={relevantBlocksToAdd}
            addBlock={addBlock}
            showAppend={showAppendNode}
            moveBlockUp={moveBlockUp}
            moveBlockDown={moveBlockDown}
          />
        </div>
        <div className={styles.configPanel}>
          <ErrorBoundary
            key={
              // Pass key to error boundary so that switching the node can potentially avoid the bad state without
              // having to reload the whole page editor frame
              activeNodeId
            }
          >
            <FormTheme.Provider value={blockConfigTheme}>
              {activeNodeId === FOUNDATION_NODE_ID ? (
                <>
                  <Col>
                    <ConnectedFieldTemplate
                      name="label"
                      label="Extension Name"
                    />
                  </Col>
                  <FoundationNode isLocked={isLocked} />
                </>
              ) : (
                <EditorNodeConfigPanel
                  key={activeNodeId}
                  blockFieldName={blockFieldName}
                  blockId={
                    blockPipeline.find((x) => x.instanceId === activeNodeId)?.id
                  }
                  blockError={blockError}
                  onRemoveNode={() => {
                    removeBlock(activeNodeId);
                  }}
                />
              )}
            </FormTheme.Provider>
          </ErrorBoundary>
        </div>
        <div className={styles.dataPanel}>
          {activeNodeId === FOUNDATION_NODE_ID ? (
            <FoundationDataPanel
              firstBlockInstanceId={blockPipeline[0]?.instanceId}
            />
          ) : (
            <DataPanel key={activeNodeId} instanceId={activeNodeId} />
          )}
        </div>
      </div>
    </Tab.Pane>
  );
};

export default EditTab;
