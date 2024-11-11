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

import HorizontalRuleButton from "@/components/richTextEditor/toolbar/HorizontalRuleButton";
import RemoveTextFormattingButton from "@/components/richTextEditor/toolbar/RemoveTextFormattingButton";
import StrikethroughButton from "@/components/richTextEditor/toolbar/StrikethroughButton";
import UnderlineButton from "@/components/richTextEditor/toolbar/UnderlineButton";
import { faEllipsisH } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button, ButtonGroup, Overlay, Popover } from "react-bootstrap";
import styles from "@/components/richTextEditor/toolbar/Toolbar.module.scss";

const OverflowPopover = () => (
  <>
    <ButtonGroup size="sm" className="mr-2">
      <UnderlineButton />
      <StrikethroughButton />
    </ButtonGroup>
    <ButtonGroup size="sm">
      <HorizontalRuleButton />
      <RemoveTextFormattingButton />
    </ButtonGroup>
  </>
);

const ToolbarOverflow = () => {
  const [show, setShow] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (buttonRef.current) {
      const rootNode = buttonRef.current.getRootNode({ composed: false });

      if (rootNode instanceof ShadowRoot) {
        setContainer(rootNode.host as HTMLElement);
      } else if (rootNode instanceof HTMLElement) {
        setContainer(rootNode);
      }
    }
  });

  const handleHide = useCallback((event: Event) => {
    // Check if the click path includes our button
    const path = event.composedPath();
    if (buttonRef.current && path.includes(buttonRef.current)) {
      return;
    }

    setShow(false);
  }, []);

  return (
    <>
      <Button
        ref={buttonRef}
        onClick={() => {
          setShow((state) => !state);
        }}
        variant="default"
        aria-label="More editing options"
      >
        <FontAwesomeIcon icon={faEllipsisH} />
      </Button>
      <Overlay
        container={container}
        target={buttonRef.current}
        show={show}
        placement="bottom"
        // rootClose
        onHide={handleHide}
      >
        <Popover
          id="toolbar-overflow-popover"
          className={styles.toolbarButtons}
          style={{ zIndex: 1050 }}
        >
          <OverflowPopover />
        </Popover>
      </Overlay>
    </>
  );
};

export default ToolbarOverflow;
