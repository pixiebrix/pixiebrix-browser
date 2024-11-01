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
import { useCurrentEditor } from "@tiptap/react";
import { Button, ButtonGroup, ButtonToolbar } from "react-bootstrap";
import styles from "@/components/richTextEditor/RichTextEditor.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBold, faItalic } from "@fortawesome/free-solid-svg-icons";

const Toolbar: React.FunctionComponent = () => {
  const { editor } = useCurrentEditor();

  if (!editor) {
    return null;
  }

  return (
    <ButtonToolbar
      className={styles.toolbar}
      aria-label="Rich-Text Editor Toolbar"
    >
      <ButtonGroup size="sm">
        <Button
          variant="default"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={
            editor.isEditable
              ? !editor.can().chain().focus().toggleBold().run()
              : true
          }
          active={editor.isActive("bold")}
          aria-label="Bold"
        >
          <FontAwesomeIcon icon={faBold} />
        </Button>
        <Button
          variant="default"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={
            editor.isEditable
              ? !editor.can().chain().focus().toggleItalic().run()
              : true
          }
          active={editor.isActive("italic")}
          aria-label="Italic"
        >
          <FontAwesomeIcon icon={faItalic} />
        </Button>
      </ButtonGroup>
    </ButtonToolbar>
  );
};

export default Toolbar;
