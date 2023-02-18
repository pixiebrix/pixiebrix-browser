/*
 * Copyright (C) 2023 PixieBrix, Inc.
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

import { PageMetadataReader } from "./PageMetadataReader";
import { PageSemanticReader } from "./PageSemanticReader";
import { BlankReader } from "./BlankReader";
import { ImageReader } from "./ImageReader";
import { SelectionReader } from "./SelectionReader";
import { ImageExifReader } from "./ImageExifReader";
import { ElementReader } from "./ElementReader";
import { registerFactory } from "./factory";
import { frameworkReadFactory } from "./frameworkReader";
import { readJQuery } from "@/blocks/readers/jquery";
import { HtmlReader } from "./HtmlReader";
import DocumentReader from "./DocumentReader";
import ManifestReader from "./ManifestReader";
import ProfileReader from "./ProfileReader";
import SessionReader from "./SessionReader";
import TimestampReader from "./TimestampReader";
import { type IBlock } from "@/core";

function getAllReaders(): IBlock[] {
  return [
    // Built-in readers
    new DocumentReader(),
    new ManifestReader(),
    new ProfileReader(),
    new SessionReader(),
    new TimestampReader(),
    new PageMetadataReader(),
    new PageSemanticReader(),
    new BlankReader(),
    new ImageReader(),
    new ImageExifReader(),
    new ElementReader(),
    new HtmlReader(),
    new SelectionReader(),
  ];
}

export function registerReaderFactories(): void {
  // Framework readers
  registerFactory("angularjs", frameworkReadFactory("angularjs"));
  registerFactory("emberjs", frameworkReadFactory("emberjs"));
  registerFactory("react", frameworkReadFactory("react"));
  registerFactory("vue", frameworkReadFactory("vue"));
  registerFactory("vuejs", frameworkReadFactory("vue"));
  registerFactory("jquery", readJQuery);
}

export default getAllReaders;
