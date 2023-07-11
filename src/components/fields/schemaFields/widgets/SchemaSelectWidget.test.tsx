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

import React from "react";
import registerDefaultWidgets from "@/components/fields/schemaFields/widgets/registerDefaultWidgets";
import { type Schema } from "@/types/schemaTypes";
import SchemaSelectWidget, {
  mapSchemaToOptions,
} from "@/components/fields/schemaFields/widgets/SchemaSelectWidget";
import { render } from "@/pageEditor/testHelpers";

const fieldName = "testField";
const fieldDescription = "this is a test field description";

describe("SchemaSelectWidget", () => {
  beforeAll(() => {
    registerDefaultWidgets();
  });

  test("renders select widget", () => {
    // Pass in schema with enum so that <Select/> is rendered
    const schema: Schema = {
      type: "string",
      enum: ["option1", "option2", "option3"],
    };
    expect(
      render(
        <SchemaSelectWidget
          name={fieldName}
          schema={schema}
          isRequired
          description={fieldDescription}
          defaultType="select"
        />,
        {
          initialValues: {
            [fieldName]: null,
          },
        }
      ).asFragment()
    ).toMatchSnapshot();
  });

  test("renders creatable widget", () => {
    // Pass in schema with examples so that <Creatable/> is rendered
    const schema: Schema = {
      type: "string",
      examples: ["option1", "option2", "option3"],
    };
    expect(
      render(
        <SchemaSelectWidget
          name={fieldName}
          schema={schema}
          isRequired
          description={fieldDescription}
          defaultType="select"
        />,
        {
          initialValues: {
            [fieldName]: null,
          },
        }
      ).asFragment()
    ).toMatchSnapshot();
  });
});

describe("mapSchemaToOptions", () => {
  it("includes current value in options", () => {
    expect(
      mapSchemaToOptions({
        schema: { type: "string", enum: [] },
        value: "foo",
        created: [],
      })
    ).toEqual({
      creatable: false,
      options: [{ value: "foo", label: "foo" }],
    });
  });

  it("returns creatable for examples", () => {
    expect(
      mapSchemaToOptions({
        schema: { type: "string", examples: [] },
        value: "foo",
        created: [],
      })
    ).toEqual({
      creatable: true,
      options: [{ value: "foo", label: "foo" }],
    });
  });

  it("extracts labelled enum values", () => {
    expect(
      mapSchemaToOptions({
        schema: { type: "string", oneOf: [{ const: "foo", title: "Foo" }] },
        value: "foo",
        created: [],
      })
    ).toEqual({
      creatable: false,
      options: [{ value: "foo", label: "Foo" }],
    });
  });
});
