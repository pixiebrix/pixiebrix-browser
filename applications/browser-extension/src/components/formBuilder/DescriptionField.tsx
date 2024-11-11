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
import { type Field } from "@rjsf/utils";
import cx from "classnames";
import MarkdownLazy from "@/components/Markdown";

type FormPreviewDescriptionFieldProps = {
  description: string | React.ReactElement;
  className?: string;
};

// RJSF implementation ref: https://github.com/rjsf-team/react-jsonschema-form/blob/main/packages/bootstrap-4/src/DescriptionField/DescriptionField.tsx
export const DescriptionField: React.VoidFunctionComponent<
  FormPreviewDescriptionFieldProps
> = ({ description, className: classNameProp }) => {
  if (!description) {
    return null;
  }

  return (
    <div className={cx("field-description", classNameProp)}>
      {typeof description === "string" ? (
        <MarkdownLazy markdown={description} />
      ) : (
        <>{description}</>
      )}
    </div>
  );
};

// Adjusting field type to match RJSF expectations
export default DescriptionField as unknown as Field;
