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

import styles from "./RichTextEditor.module.scss";
import { EditorProvider, type EditorProviderProps } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { Link } from "@tiptap/extension-link";
import { Image } from "@tiptap/extension-image";
import React from "react";
import Toolbar from "@/components/richTextEditor/toolbar/Toolbar";

type EditorProps = EditorProviderProps & {
  disabledExtensions?: string[];
};

const RichTextEditor: React.FunctionComponent<EditorProps> = (
  props: EditorProps,
) => (
  <div className={styles.root}>
    <EditorProvider
      extensions={[
        StarterKit,
        Underline,
        Link.extend({ inclusive: false }).configure({ openOnClick: false }),
        ...(props.disabledExtensions?.includes("image") ? [] : [Image]),
      ]}
      slotBefore={<Toolbar />}
      {...props}
    />
  </div>
);

export default RichTextEditor;
