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

import React, { type PropsWithChildren } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { waitForEffect } from "./testHelpers";

type RenderFn = (ui: React.ReactElement) => RenderResult;

export type ItRendersOptions<TProps> = {
  Component: React.ComponentType<TProps>;
  props: TProps;
  testName?: string;
  TemplateComponent?: React.ComponentType<PropsWithChildren<unknown>>;
  isAsync?: boolean;
  renderFn?: RenderFn;
};

function testItRenders<TProps = unknown>(
  options: ItRendersOptions<TProps> | (() => ItRendersOptions<TProps>)
) {
  const {
    Component,
    props,
    testName = "It renders",
    TemplateComponent,
    isAsync = false,
    renderFn = render,
  } = typeof options === "function" ? options() : options;

  // eslint-disable-next-line jest/valid-title
  test(testName, async () => {
    const ui = TemplateComponent ? (
      <TemplateComponent>
        <Component {...props} />
      </TemplateComponent>
    ) : (
      <Component {...props} />
    );
    const { asFragment } = renderFn(ui);
    if (isAsync) {
      await waitForEffect();
    }

    expect(asFragment()).toMatchSnapshot();
  });
}

export default testItRenders;
