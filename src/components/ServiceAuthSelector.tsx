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

import React, { type ComponentType, type CSSProperties, useMemo } from "react";
import { useField } from "formik";
// eslint-disable-next-line no-restricted-imports -- TODO: Fix over time
import { Form } from "react-bootstrap";
import Select, {
  type GroupBase,
  type StylesConfig,
  type MenuListProps,
} from "react-select";

import { PIXIEBRIX_INTEGRATION_ID } from "@/services/constants";
import { type AuthOption } from "@/auth/authTypes";
import useAsyncEffect from "use-async-effect";

// CustomStyles.js
const colors = {
  error: "#dc3545",
  divider: "#ebedf2",
};

const customStyles: StylesConfig<AuthOption> = {
  // @ts-expect-error not sure how to pass the genetic argument to the react-select types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control(base: CSSProperties, state: { selectProps: any }) {
    let statusColor = colors.divider;

    if (state.selectProps.error) {
      // "state.selectProps" references the component props
      statusColor = colors.error;
    }

    return {
      ...base,
      borderColor: statusColor,
    };
  },
};

const ServiceAuthSelector: React.FunctionComponent<{
  name: string;
  serviceId: string;
  authOptions: AuthOption[];
  CustomMenuList?: ComponentType<
    MenuListProps<AuthOption, boolean, GroupBase<AuthOption>>
  >;
}> = ({ authOptions, serviceId, CustomMenuList, ...props }) => {
  const [field, , helpers] = useField(props);
  const options = useMemo(
    () => authOptions.filter((x) => x.serviceId === serviceId),
    [authOptions, serviceId]
  );

  // `react-select` barfs on undefined component overrides
  const components = useMemo(
    () => (CustomMenuList ? { MenuList: CustomMenuList } : {}),
    [CustomMenuList]
  );

  // Automatically default the field value if there's only one option available
  useAsyncEffect(async () => {
    if (authOptions.length === 1 && field.value == null) {
      await helpers.setValue(authOptions[0].value);
    }
  }, [helpers, authOptions, field.value]);

  const value = useMemo(
    () => authOptions.filter((x) => x.value === field.value),
    [field.value, authOptions]
  );

  if (serviceId === PIXIEBRIX_INTEGRATION_ID) {
    return (
      <Form.Group controlId={field.name}>
        <Form.Control type="text" readOnly value="Automatic" />
      </Form.Group>
    );
  }

  return (
    <Form.Group controlId={field.name}>
      <Select
        styles={customStyles}
        name={field.name}
        options={options}
        value={value}
        placeholder={"Select configuration..."}
        components={components}
        onChange={async (x: AuthOption) => {
          console.debug(`Selected option ${x.value} (${x.label})`);
          await helpers.setValue(x.value);
        }}
      />
    </Form.Group>
  );
};

export default ServiceAuthSelector;
