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
  DocumentElement,
  PreviewComponentProps,
} from "@/components/documentBuilder/documentBuilderTypes";
import cx from "classnames";
import documentTreeStyles from "@/components/documentBuilder/preview/documentTree.module.scss";
import PopupLabels from "./PopupLabels";
import elementTypeLabels from "@/components/documentBuilder/elementTypeLabels";

type ContainerProps = PreviewComponentProps & {
  element: DocumentElement;
  documentComponent: DocumentComponent;
};

const Container: React.FunctionComponent<ContainerProps> = ({
  element,
  documentComponent: { Component, props },
  children,
  className,
  documentBodyName,
  elementName,
  isHovered,
  isActive,
  ...restPreviewProps
}) => (
  <Component
    {...restPreviewProps}
    className={cx(props.className, className, documentTreeStyles.container)}
  >
    <PopupLabels
      className={documentTreeStyles.labelShiftUp}
      elementType={element.type}
      documentBodyName={documentBodyName}
      elementName={elementName}
      isHovered={isHovered}
      isActive={isActive}
    />
    {children}
    {!element.children?.length && (
      <span className="text-muted">{elementTypeLabels[element.type]}</span>
    )}
  </Component>
);

export default Container;
