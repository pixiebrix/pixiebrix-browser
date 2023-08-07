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

import React, { Suspense, lazy } from "react";
import { type IconOption } from "@/icons/types";
import { useField } from "formik";
import { type CustomFieldWidget } from "@/components/form/FieldTemplate";
import { type IconLibrary } from "@/types/iconTypes";

const IconSelector = lazy(
  async () =>
    import(
      /* webpackChunkName: "icons" */
      "@/icons/IconSelector"
    )
);

type IconValue = {
  id: string;
  library: IconLibrary;
  size: number;
};

const IconWidget: CustomFieldWidget = (props) => {
  const [field, meta, helpers] = useField<IconValue>(props);

  const handleSelect = async (option: IconOption | null) => {
    if (option) {
      const { value } = option;
      await helpers.setValue({
        id: value.id,
        library: value.library,
        size: field.value?.size ?? 16,
      });
    } else {
      await helpers.setValue(null);
    }

    await helpers.setTouched(true);
  };

  return (
    <Suspense fallback={<div>Loading icons...</div>}>
      <IconSelector
        value={meta.value}
        onChange={handleSelect}
        disabled={props.disabled}
      />
    </Suspense>
  );
};

export default IconWidget;
