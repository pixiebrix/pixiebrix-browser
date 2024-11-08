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

import React from "react";
import FieldTemplate from "@/components/form/FieldTemplate";
import LayoutWidget from "@/components/LayoutWidget";
import useMoveWithinParent from "../hooks/useMoveWithinParent";

type MoveElementProps = {
  documentBodyName: string;
};

const MoveElement: React.FC<MoveElementProps> = ({ documentBodyName }) => {
  const { canMoveUp, canMoveDown, moveElement } =
    useMoveWithinParent(documentBodyName);

  return canMoveUp || canMoveDown ? (
    <FieldTemplate
      name="layoutButtons"
      label="Element Order"
      as={LayoutWidget}
      canMoveUp={canMoveUp}
      moveUp={() => {
        moveElement("up");
      }}
      canMoveDown={canMoveDown}
      moveDown={() => {
        moveElement("down");
      }}
    />
  ) : null;
};

export default MoveElement;
