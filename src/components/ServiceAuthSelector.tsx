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

import React, { ComponentType, CSSProperties, useEffect, useMemo } from "react";
import { useField } from "formik";
import { Form } from "react-bootstrap";
import Select, {
  GroupTypeBase,
  MenuListComponentProps,
  StylesConfig,
} from "react-select";
import { PIXIEBRIX_SERVICE_ID } from "@/services/constants";
import { AuthOption } from "@/auth/authTypes";

// CustomStyles.js
const colors = {
  error: "#dc3545",
  divider: "#ebedf2",
};

const customStyles: StylesConfig<AuthOption, boolean> = {
  // @ts-expect-error not sure how to pass the genetic argument to the react-select types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: (base: CSSProperties, state: { selectProps: any }) => {
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
    MenuListComponentProps<AuthOption, boolean, GroupTypeBase<AuthOption>>
  >;
}> = ({ authOptions, serviceId, CustomMenuList, ...props }) => {
  const [field, meta, helpers] = useField(props);
  const options = useMemo(
    () => authOptions.filter((x) => x.serviceId === serviceId),
    [authOptions, serviceId]
  );

  // `react-select` barfs on undefined component overrides
  const components = useMemo(
    () => (CustomMenuList ? { MenuList: CustomMenuList } : {}),
    [CustomMenuList]
  );

  useEffect(() => {
    if (authOptions.length === 1 && field.value == null) {
      helpers.setValue(authOptions[0].value);
    }
  }, [helpers, authOptions, field.value]);

  const value = useMemo(
    () => authOptions.filter((x) => x.value === field.value),
    [field.value, authOptions]
  );

  if (serviceId === PIXIEBRIX_SERVICE_ID) {
    return (
      <Form.Group controlId={field.name}>
        <Form.Control type="text" readOnly value="Automatic" />
        {meta.error && (
          <Form.Control.Feedback type="invalid" style={{ display: "inline" }}>
            {meta.error}
          </Form.Control.Feedback>
        )}
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
        error={Boolean(meta.error)}
        components={components}
        onChange={(x: AuthOption) => {
          console.debug(`Selected option ${x.value} (${x.label})`);
          helpers.setValue(x.value);
        }}
      />
      {meta.error && (
        <Form.Control.Feedback type="invalid" style={{ display: "inline" }}>
          {meta.error}
        </Form.Control.Feedback>
      )}
    </Form.Group>
  );
};

export default ServiceAuthSelector;
