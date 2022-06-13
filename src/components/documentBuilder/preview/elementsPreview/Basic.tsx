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

import React from "react";
import {
  DocumentComponent,
  DocumentElementType,
  PreviewComponentProps,
} from "@/components/documentBuilder/documentBuilderTypes";
import cx from "classnames";
import documentTreeStyles from "@/components/documentBuilder/preview/documentTree.module.scss";
import HoveredLabel from "@/components/documentBuilder/preview/HoveredLabel";
import ActiveLabel from "@/components/documentBuilder/preview/ActiveLabel";

type BasicProps = PreviewComponentProps & {
  elementType: DocumentElementType;
  documentComponent: DocumentComponent;
};

const Basic: React.FunctionComponent<BasicProps> = ({
  elementType,
  documentComponent: { Component, props },
  children,
  className,
  isHovered,
  isActive,
  onSelectParent,
  ...restPreviewProps
}) => (
  <div
    className={cx(documentTreeStyles.wrapperShiftRight, className)}
    {...restPreviewProps}
  >
    {isHovered && (
      <HoveredLabel
        className={documentTreeStyles.labelShiftRight}
        elementType={elementType}
      />
    )}
    {isActive && (
      <ActiveLabel
        className={documentTreeStyles.labelShiftRight}
        selectParent={onSelectParent}
      />
    )}
    <Component {...props} />
  </div>
);

export default Basic;
