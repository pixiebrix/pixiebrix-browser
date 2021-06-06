/*
 * Copyright (C) 2020 Pixie Brix, LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// Required for react-select-virtualized https://github.com/guiyep/react-select-virtualized/issues/283
import "regenerator-runtime/runtime";

// @ts-ignore: no types for this one :(
import Select from "react-select-virtualized";
import React, { useMemo } from "react";
import { iconOptions } from "@/icons/svgIcons";
import { IconOption } from "@/icons/types";
import Icon from "./Icon";
import { IconLibrary } from "@/core";

// https://github.com/JedWatson/react-select/issues/3480#issuecomment-481566579
function customSingleValue({ data }: { data: IconOption }): JSX.Element {
  return (
    <div className="input-select">
      <div className="input-select__single-value">
        <span className="input-select__icon mr-2">
          <Icon icon={data.value.id} library={data.value.library} />
        </span>
        <span>{data.label}</span>
      </div>
    </div>
  );
}

interface OwnProps {
  value: { id: string; library: IconLibrary };
  isClearable?: boolean;
  onChange: (option: IconOption | null) => void;
}

const IconSelector: React.FunctionComponent<OwnProps> = ({
  value,
  isClearable = true,
  onChange,
}) => {
  const selectedOption = useMemo(() => {
    if (value) {
      return iconOptions.find(
        (x) => x.value.library === value.library && x.value.id === value.id
      );
    } else {
      return null;
    }
  }, [value]);

  return (
    <Select
      isClearable={isClearable}
      value={selectedOption}
      options={iconOptions}
      onChange={onChange}
      // react-select-virtualized doesn't support styling the elements in the dropdown, so can't show
      // the icons in the actual dropdown
      components={{ SingleValue: customSingleValue }}
    />
  );
};

export default IconSelector;
