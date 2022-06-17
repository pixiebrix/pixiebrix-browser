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

import React, { useMemo } from "react";
import TooltipIconButton from "@/components/TooltipIconButton";
import { faPlus, faPlusCircle } from "@fortawesome/free-solid-svg-icons";
import BrickModal from "@/components/brickModal/BrickModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { TypedBlock, TypedBlockMap } from "@/blocks/registry";
import { IBlock } from "@/core";

const addBrickCaption = (
  <span>
    <FontAwesomeIcon icon={faPlus} className="mr-1" /> Add brick
  </span>
);

type AddBrickActionProps = {
  blocks: TypedBlockMap;
  isBlockAllowed: (block: TypedBlock) => boolean;
  nodeName: string;
  onSelectBlock: (block: IBlock) => void;
};

const AddBrickAction: React.VFC<AddBrickActionProps> = ({
  blocks,
  nodeName,
  onSelectBlock,
  isBlockAllowed,
}) => {
  const relevantBricks = useMemo(
    () =>
      [...blocks.values()]
        .filter((x) => isBlockAllowed(x))
        .map(({ block }) => block),
    [blocks, isBlockAllowed]
  );

  return (
    <BrickModal
      bricks={relevantBricks}
      renderButton={(onClick) => (
        <TooltipIconButton
          name={`add-node-${nodeName}`}
          icon={faPlusCircle}
          onClick={onClick}
          tooltipText="Add a brick"
        />
      )}
      selectCaption={addBrickCaption}
      onSelect={onSelectBlock}
    />
  );
};

export default AddBrickAction;
