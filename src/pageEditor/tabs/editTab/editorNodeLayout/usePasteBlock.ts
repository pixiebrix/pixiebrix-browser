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

import { useDispatch, useSelector } from "react-redux";
import { selectCopiedBlock } from "@/pageEditor/slices/editorSelectors";
import { uuidv4 } from "@/types/helpers";
import { BlockConfig } from "@/blocks/types";
import { actions } from "@/pageEditor/slices/editorSlice";

function usePasteBlock():
  | ((pipelinePath: string, pipelineIndex: number) => void)
  | null {
  const dispatch = useDispatch();
  const copiedBlock = useSelector(selectCopiedBlock);
  if (copiedBlock == null) {
    return null;
  }

  return (pipelinePath: string, pipelineIndex: number) => {
    // Give the block a new instanceId
    const newInstanceId = uuidv4();
    const blockToPaste: BlockConfig = {
      ...copiedBlock,
      instanceId: newInstanceId,
    };
    // Insert the block
    dispatch(
      actions.addNode({ block: blockToPaste, pipelinePath, pipelineIndex })
    );
    dispatch(actions.clearCopiedBlockConfig());
  };
}

export default usePasteBlock;
