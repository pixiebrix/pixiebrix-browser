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

import React, { ChangeEvent } from "react";
import BootstrapSwitchButton from "bootstrap-switch-button-react";
import { Except } from "type-fest";
import { FieldProps } from "@/components/form/FieldTemplate";

export type CheckBoxLike = {
  name: string;
  value: boolean;
};

export type SwitchButtonProps = Except<FieldProps, "onChange"> & {
  onChange: React.ChangeEventHandler<CheckBoxLike>;
};

const SwitchButtonWidget: React.FC<SwitchButtonProps> = ({
  name,
  onChange,
  value,
}) => {
  const patchedOnChange = (checked: boolean) => {
    onChange({
      target: { value: checked, name },
    } as ChangeEvent<CheckBoxLike>);
  };

  return (
    <BootstrapSwitchButton
      onlabel=" "
      offlabel=" "
      checked={value}
      onChange={patchedOnChange}
    />
  );
};

export default SwitchButtonWidget;
