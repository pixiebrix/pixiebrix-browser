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

import BaseInputTemplate from "@/components/formBuilder/BaseInputTemplate";
import DescriptionFieldTemplate from "@/components/formBuilder/DescriptionFieldTemplate";
import FieldTemplate from "@/components/formBuilder/FieldTemplate";
import { type FormProps } from "@rjsf/core";

export const templates = {
  FieldTemplate,
  DescriptionFieldTemplate,
  BaseInputTemplate,
} satisfies FormProps["templates"];
