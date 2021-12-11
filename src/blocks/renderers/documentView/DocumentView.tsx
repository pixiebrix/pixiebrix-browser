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

import { buildDocumentBranch } from "@/components/documentBuilder/documentTree";
import React from "react";
import ReactShadowRoot from "react-shadow-root";
import BootstrapStylesheet from "@/blocks/renderers/BootstrapStylesheet";
import { DocumentViewProps as DocumentViewProperties } from "./DocumentViewProps";
import DocumentContext from "@/components/documentBuilder/DocumentContext";

const DocumentView: React.FC<DocumentViewProperties> = ({ body, options }) => (
  // Wrap in a React context provider that passes BlockOptions down to any embedded bricks
  // ReactShadowRoot needs to be inside an HTMLElement so it has something to attach to
  <DocumentContext.Provider value={{ options }}>
    <div className="h-100">
      <ReactShadowRoot>
        <BootstrapStylesheet />
        {body.map((documentElement, index) => {
          const { Component, props } = buildDocumentBranch(documentElement);
          return <Component key={index} {...props} />;
        })}
      </ReactShadowRoot>
    </div>
  </DocumentContext.Provider>
);

export default DocumentView;
