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

import { render } from "@/pageEditor/testHelpers";
import React from "react";
import JQueryReaderOptions, {
  inferActiveTypeOption,
  typeOptionsFactory,
} from "@/blocks/transformers/jquery/JQueryReaderOptions";
import { type FormState } from "@/pageEditor/extensionPoints/formStateTypes";
// eslint-disable-next-line no-restricted-imports -- using to simplify Formik state for test
import { Formik } from "formik";
import { menuItemFormStateFactory } from "@/testUtils/factories/pageEditorFactories";
import { JQueryReader } from "@/blocks/transformers/jquery/JQueryReader";
import registerDefaultWidgets from "@/components/fields/schemaFields/widgets/registerDefaultWidgets";
import { waitForEffect } from "@/testUtils/testHelpers";
import {
  makeTemplateExpression,
  makeVariableExpression,
} from "@/runtime/expressionCreators";
import { getAttributeExamples } from "@/contentScript/messenger/api";
import { screen } from "@testing-library/react";
import SchemaFieldContext from "@/components/fields/schemaFields/SchemaFieldContext";
import devtoolFieldOverrides from "@/pageEditor/fields/devtoolFieldOverrides";
import userEvent from "@testing-library/user-event";

jest.mock("@/contentScript/messenger/api", () => ({
  getAttributeExamples: jest.fn(),
}));

const getAttributeExamplesMock = jest.mocked(getAttributeExamples);

function baseStateFactory() {
  const baseFormState = menuItemFormStateFactory();
  baseFormState.extension.blockPipeline = [
    {
      id: JQueryReader.BRICK_ID,
      config: {
        selectors: {},
      },
    },
  ];
  return baseFormState;
}

function renderOptions(formState: FormState = baseStateFactory()) {
  return render(
    <SchemaFieldContext.Provider value={devtoolFieldOverrides}>
      <Formik onSubmit={jest.fn()} initialValues={formState}>
        <JQueryReaderOptions
          name="extension.blockPipeline.0"
          configKey="config"
        />
      </Formik>
    </SchemaFieldContext.Provider>
  );
}

beforeAll(() => {
  registerDefaultWidgets();
});

beforeEach(() => {
  getAttributeExamplesMock.mockClear();
  getAttributeExamplesMock.mockResolvedValue([]);
});

describe("JQueryReaderOptions", () => {
  it("renders empty config without crashing", () => {
    renderOptions();
    expect(screen.getByText("Add Property")).toBeInTheDocument();
  });

  it("shows workshop message on variable selector", async () => {
    const state = baseStateFactory();
    state.extension.blockPipeline[0].config.selectors = {
      property: makeVariableExpression("@foo"),
    };

    const { container } = renderOptions(state);

    await waitForEffect();

    expect(screen.queryByText("Add Property")).not.toBeInTheDocument();
    expect(container.querySelector(".alert")).toBeInTheDocument();
  });

  it("shows workshop message variable selectors", async () => {
    const state = baseStateFactory();
    state.extension.blockPipeline[0].config.selectors =
      makeVariableExpression("@foo");

    const { container } = renderOptions(state);

    await waitForEffect();

    expect(screen.queryByText("Add New Property")).not.toBeInTheDocument();
    expect(container.querySelector(".alert")).toBeInTheDocument();
  });

  it("normalizes primitive selectors", async () => {
    const state = baseStateFactory();
    state.extension.blockPipeline[0].config.selectors = { property: "h1" };

    renderOptions(state);

    await waitForEffect();

    expect(screen.getByPlaceholderText("Property name")).toHaveValue(
      "property"
    );

    expect(
      screen.getByTestId(
        "toggle-extension.blockPipeline.0.config.selectors.property.selector"
      ).dataset.testSelected
    ).toEqual("Selector");

    expect(screen.getByPlaceholderText("Select an element")).toHaveValue("h1");
  });

  it("normalizes nested selectors", async () => {
    const state = baseStateFactory();
    state.extension.blockPipeline[0].config.selectors = {
      outer: {
        selector: "div",
        find: {
          inner: "h1",
        },
      },
    };

    renderOptions(state);

    await waitForEffect();

    expect(
      screen.getByTestId(
        "toggle-extension.blockPipeline.0.config.selectors.outer.selector"
      ).dataset.testSelected
    ).toEqual("Selector");
    expect(
      screen.getByTestId(
        "toggle-extension.blockPipeline.0.config.selectors.outer.find.inner.selector"
      ).dataset.testSelected
    ).toEqual("Selector");

    expect(screen.queryAllByText("Loading...")).toHaveLength(0);
  });

  it("normalizes nunjucks literal selectors", async () => {
    const state = baseStateFactory();
    state.extension.blockPipeline[0].config.selectors = {
      outer: {
        selector: makeTemplateExpression("nunjucks", "div"),
        find: {
          inner: makeTemplateExpression("nunjucks", "h1"),
        },
      },
    };

    renderOptions(state);

    await waitForEffect();

    expect(
      screen.getByTestId(
        "toggle-extension.blockPipeline.0.config.selectors.outer.selector"
      ).dataset.testSelected
    ).toEqual("Selector");
    expect(
      screen.getByTestId(
        "toggle-extension.blockPipeline.0.config.selectors.outer.find.inner.selector"
      ).dataset.testSelected
    ).toEqual("Selector");

    expect(screen.queryAllByText("Loading...")).toHaveLength(0);
  });

  it("allows rename of property", async () => {
    const state = baseStateFactory();
    state.extension.blockPipeline[0].config.selectors = {
      outer: {
        selector: makeTemplateExpression("nunjucks", "div"),
        find: {
          inner: makeTemplateExpression("nunjucks", "h1"),
        },
      },
    };

    const { container } = renderOptions(state);

    await waitForEffect();

    const field = container.querySelector('[value="outer"]');

    await userEvent.type(field, "property");
    // Click away to blur the field
    await userEvent.click(screen.getAllByText("Select All")[0]);

    await waitForEffect();

    expect(field).toHaveValue("outerproperty");
  });

  it("generates example attributes for nested selectors", async () => {
    const state = baseStateFactory();
    state.extension.blockPipeline[0].config.selectors = {
      outer: {
        selector: "div",
        find: {
          inner: {
            selector: "h1",
          },
        },
      },
    };

    renderOptions(state);

    await waitForEffect();

    expect(getAttributeExamplesMock).toHaveBeenCalledWith(
      { frameId: 0, tabId: 0 },
      "div"
    );
    expect(getAttributeExamplesMock).toHaveBeenCalledWith(
      { frameId: 0, tabId: 0 },
      "div h1"
    );
  });
});

describe("type options", () => {
  it("infers element", () => {
    expect(
      inferActiveTypeOption({
        selector: "div",
        multi: false,
        find: {},
      })
    ).toEqual("element");
  });

  it("infers attribute", () => {
    expect(
      inferActiveTypeOption({
        selector: "div",
        multi: false,
        attr: "foo",
      })
    ).toEqual("attr:foo");
  });

  it("infers data attribute", () => {
    expect(
      inferActiveTypeOption({
        selector: "div",
        data: "foo",
        multi: false,
      })
    ).toEqual("attr:data-foo");
  });

  it("creates new option for unknown type", () => {
    expect(typeOptionsFactory([], "attr:data-foo")).toEqual([
      { label: "Text", value: "text" },
      { label: "Element", value: "element" },
      { label: "data-foo", value: "attr:data-foo" },
    ]);
  });

  it("matches data attribute", () => {
    expect(
      typeOptionsFactory([{ name: "data-foo", value: "abc" }], "attr:data-foo")
    ).toEqual([
      { label: "Text", value: "text" },
      { label: "Element", value: "element" },
      { label: "data-foo - abc", value: "attr:data-foo" },
    ]);
  });
});
