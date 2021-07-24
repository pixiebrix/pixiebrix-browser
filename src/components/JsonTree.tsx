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

import VendorJSONTree from "react-json-tree";
import { jsonTreeTheme as theme } from "@/themes/light";
import React from "react";

const JsonTree: React.FunctionComponent<Partial<VendorJSONTree["props"]>> = (
  props
) => <VendorJSONTree hideRoot theme={theme} invertTheme {...props} />;

export default JsonTree;
