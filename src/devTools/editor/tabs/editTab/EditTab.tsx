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
  LayoutNodeProps,
  NodeId,
} from "@/devTools/editor/tabs/editTab/editorNodeLayout/EditorNodeLayout";
import { useFormikContext } from "formik";
import { BlockConfig } from "@/blocks/types";
import { ADAPTERS } from "@/devTools/editor/extensionPoints/adapter";
import { BlockType, defaultBlockConfig, getType } from "@/blocks/util";
import { useAsyncState } from "@/hooks/common";
import blockRegistry from "@/blocks/registry";
import { compact, zip } from "lodash";
import { IBlock, OutputKey, UUID } from "@/core";
import hash from "object-hash";
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
import usePipelineField from "@/devTools/editor/hooks/usePipelineField";

async function filterBlocks(
  blocks: IBlock[],
  { excludeTypes = [] }: { excludeTypes: BlockType[] }
): Promise<IBlock[]> {
  const types = await Promise.all(blocks.map(async (block) => getType(block)));
  // Exclude null to exclude foundations
  return zip(blocks, types)
    .filter(([, type]) => type != null && !excludeTypes.includes(type))
    .map(([block]) => block);
}

const blockConfigTheme: ThemeProps = {
  layout: "horizontal",
};

const EditTab: React.FC<{
  eventKey: string;
}> = ({ eventKey }) => {
  useExtensionTrace();
  // ToDo Figure out how to properly bind field validation errors to Formik state // useRuntimeErrors(pipelineFieldName);

  const { values, setValues: setFormValues } = useFormikContext<FormState>();
  const { extensionPoint, type: elementType } = values;

  // For now, don't allow modifying extensionPoint packages via the Page Editor.
  const isLocked = useMemo(
    () => !isInnerExtensionPoint(extensionPoint.metadata.id),
    [extensionPoint.metadata.id]
  );

  const { label, icon, EditorNode: FoundationNode } = ADAPTERS.get(elementType);

  const {
    blockPipeline,
    blockPipelineErrors,
    errorTraceEntry,
  } = usePipelineField();

  const [activeNodeId, setActiveNodeId] = useState<NodeId>(FOUNDATION_NODE_ID);
  const activeBlockIndex = useMemo(() => {
    if (activeNodeId === FOUNDATION_NODE_ID) {
      return 0;
    }

    return blockPipeline.findIndex(
      (block) => block.instanceId === activeNodeId
    );
  }, [activeNodeId, blockPipeline]);

  const blockFieldName = useMemo(
    () => `extension.blockPipeline[${activeBlockIndex}]`,
    [activeBlockIndex]
  );

  // Load once
  const [allBlocks] = useAsyncState(async () => blockRegistry.all(), [], []);

  const pipelineIdHash = hash(blockPipeline.map((x) => x.id));
  const resolvedBlocks = useMemo(
    () =>
      blockPipeline.map(({ id }) =>
        (allBlocks ?? []).find((block) => block.id === id)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- using actionsHash since we only use the actions ids
    [allBlocks, pipelineIdHash]
  );

  const [showAppendNode] = useAsyncState(
    async () => {
      if (!resolvedBlocks || resolvedBlocks.length === 0) {
        return true;
      }

      const lastId = blockPipeline[blockPipeline.length - 1].id;
      const lastResolved = resolvedBlocks.find((block) => block.id === lastId);
      if (!lastResolved) {
        return true;
      }

      const lastType = await getType(lastResolved);
      return lastType !== "renderer";
    },
    [resolvedBlocks, blockPipeline],
    false
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

  const blockNodes: LayoutNodeProps[] = blockPipeline.map(
    (blockConfig, index) => {
      // eslint-disable-next-line security/detect-object-injection
      const block = resolvedBlocks[index];
      const nodeId = blockConfig.instanceId;
      return block
        ? {
            nodeId,
            title: isNullOrBlank(blockConfig.label)
              ? block?.name
              : blockConfig.label,
            outputKey: blockConfig.outputKey,
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
            hasError: Boolean(
              (blockPipelineErrors as Record<string, unknown>)?.[String(index)]
            ),
            hasWarning:
              errorTraceEntry?.blockInstanceId === blockConfig.instanceId,
            onClick: () => {
              setActiveNodeId(blockConfig.instanceId);
            },
          }
        : {
            nodeId,
            title: "Loading...",
          };
    }
  );

  const foundationNode: LayoutNodeProps = useMemo(
    () => ({
      nodeId: FOUNDATION_NODE_ID,
      outputKey: "input",
      title: label,
      icon,
      onClick: () => {
        setActiveNodeId(FOUNDATION_NODE_ID);
      },
    }),
    [icon, label]
  );

  const nodes: LayoutNodeProps[] = [foundationNode, ...blockNodes];

  const [relevantBlocksToAdd] = useAsyncState(async () => {
    const excludeTypes: BlockType[] = ["actionPanel", "panel"].includes(
      elementType
    )
      ? ["effect"]
      : ["renderer"];
    return filterBlocks(allBlocks, { excludeTypes });
  }, [allBlocks, elementType]);

  const addBlock = useCallback(
    async (block: IBlock, beforeInstanceId?: UUID) => {
      const insertIndex = beforeInstanceId
        ? blockPipeline.findIndex((x) => x.instanceId === beforeInstanceId)
        : blockPipeline.length;
      const newBlock: BlockConfig = {
        id: block.id,
        outputKey: await generateFreshOutputKey(
          block,
          compact([
            "input" as OutputKey,
            ...blockPipeline.map((x) => x.outputKey),
          ])
        ),
        instanceId: uuidv4(),
        config:
          getExampleBlockConfig(block) ?? defaultBlockConfig(block.inputSchema),
      };
      const nextState = produce(values, (draft) => {
        draft.extension.blockPipeline.splice(insertIndex, 0, newBlock);
      });
      setFormValues(nextState);
      setActiveNodeId(newBlock.instanceId);
    },
    [blockPipeline, values, setFormValues]
  );

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
          />
        </div>
        <div className={styles.configPanel}>
          <ErrorBoundary>
            <FormTheme.Provider value={blockConfigTheme}>
              {activeNodeId === FOUNDATION_NODE_ID && (
                <>
                  <Col>
                    <ConnectedFieldTemplate
                      name="label"
                      label="Extension Name"
                    />
                  </Col>
                  <FoundationNode isLocked={isLocked} />
                </>
              )}

              {activeNodeId !== FOUNDATION_NODE_ID && (
                <EditorNodeConfigPanel
                  key={activeNodeId}
                  blockFieldName={blockFieldName}
                  blockId={
                    blockPipeline.find((x) => x.instanceId === activeNodeId)?.id
                  }
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
