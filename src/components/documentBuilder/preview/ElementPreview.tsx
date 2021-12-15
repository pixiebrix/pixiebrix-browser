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

import React, { MouseEventHandler, useMemo } from "react";
import styles from "./ElementPreview.module.scss";
import cx from "classnames";
import {
  DocumentElement,
  isListElement,
} from "@/components/documentBuilder/documentBuilderTypes";
import { getPreviewComponentDefinition } from "@/components/documentBuilder/documentTree";
import AddElementAction from "./AddElementAction";
import { useField } from "formik";
import { getAllowedChildTypes } from "@/components/documentBuilder/allowedElementTypes";

export type ElementPreviewProps = {
  elementName: string;
  activeElement: string | null;
  setActiveElement: (name: string | null) => void;
  hoveredElement: string | null;
  setHoveredElement: (name: string | null) => void;
  menuBoundary?: Element;
};

const ElementPreview: React.FC<ElementPreviewProps> = ({
  elementName,
  activeElement,
  setActiveElement,
  hoveredElement,
  setHoveredElement,
  menuBoundary,
}) => {
  const [{ value: documentElement }] = useField<DocumentElement>(elementName);
  const isActive = activeElement === elementName;
  const isHovered = hoveredElement === elementName && !isActive;
  const onClick: MouseEventHandler<HTMLDivElement> = (event) => {
    event.stopPropagation();

    if (!isActive) {
      setActiveElement(elementName);
    }
  };

  const onMouseOver: MouseEventHandler<HTMLDivElement> = (event) => {
    event.stopPropagation();
    if (hoveredElement !== elementName) {
      setHoveredElement(elementName);
    }
  };

  const onMouseLeave: MouseEventHandler<HTMLDivElement> = () => {
    if (hoveredElement === elementName) {
      setHoveredElement(null);
    }
  };

  // Render children and Add Menu for the container element
  const isContainer = Array.isArray(documentElement.children);

  // Render the item template and the Item Type Selector for the list element
  const isList = isListElement(documentElement);

  const { Component: PreviewComponent, props } = useMemo(
    () => getPreviewComponentDefinition(documentElement),
    [documentElement]
  );

  return (
    <PreviewComponent
      {...props}
      onClick={onClick}
      className={cx(props?.className, styles.root, {
        [styles.active]: isActive,
        [styles.hovered]: isHovered,
      })}
      onMouseOver={onMouseOver}
      onMouseLeave={onMouseLeave}
    >
      {props?.children}
      {isContainer &&
        documentElement.children.map((childElement, i) => (
          <ElementPreview
            key={`${elementName}.children.${i}`}
            elementName={`${elementName}.children.${i}`}
            activeElement={activeElement}
            setActiveElement={setActiveElement}
            menuBoundary={menuBoundary}
            hoveredElement={hoveredElement}
            setHoveredElement={setHoveredElement}
          />
        ))}
      {isContainer && (
        <AddElementAction
          elementsCollectionName={`${elementName}.children`}
          allowedTypes={getAllowedChildTypes(documentElement)}
          className={styles.addElement}
          menuBoundary={menuBoundary}
        />
      )}
      {isList && (
        <ElementPreview
          elementName={`${elementName}.config.element.__value__`}
          activeElement={activeElement}
          setActiveElement={setActiveElement}
          menuBoundary={menuBoundary}
          hoveredElement={hoveredElement}
          setHoveredElement={setHoveredElement}
        />
      )}
    </PreviewComponent>
  );
};

export default ElementPreview;
