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

/**
 * @file This file exists to facilitate testing/mocking. The function cannot live
 * in SelectionToolPopover.tsx because it must import it asynchronously.
 */

import React from "react";
import { render } from "react-dom";
import IsolatedComponent from "@/components/IsolatedComponent";
import type Component from "@/components/selectionToolPopover/SelectionToolPopover";

export default function showSelectionToolPopover({
  rootElement,
  ...props
}: {
  rootElement: HTMLElement;
} & React.ComponentProps<typeof Component>) {
  render(
    <IsolatedComponent
      webpackChunkName="SelectionToolPopover"
      lazy={async () =>
        import(
          /* webpackChunkName: "isolated/SelectionToolPopover" */
          "@/components/selectionToolPopover/SelectionToolPopover"
        )
      }
      factory={(SelectionToolPopover) => <SelectionToolPopover {...props} />}
    ></IsolatedComponent>,
    rootElement,
  );
}
