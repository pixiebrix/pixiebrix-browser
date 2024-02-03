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

import { getFormDefinition } from "@/contentScript/messenger/strict/api";
import { render, screen } from "@testing-library/react";
import React from "react";
import EphemeralForm from "./EphemeralForm";

jest.mock("@/contentScript/messenger/strict/api");

const getFormDefinitionMock = jest.mocked(getFormDefinition);

describe("EphemeralForm", () => {
  it("shows field titles", async () => {
    getFormDefinitionMock.mockResolvedValue({
      schema: {
        title: "Test Form",
        type: "object",
        properties: {
          foo: {
            type: "string",
            title: "Foo",
          },
        },
      },
      uiSchema: {},
      cancelable: false,
      submitCaption: "Submit",
      location: "modal",
    });

    render(<EphemeralForm />);

    await expect(
      screen.findByRole("textbox", { name: /foo/i }),
    ).resolves.toBeVisible();
  });

  it("supports markdown in field descriptions", async () => {
    getFormDefinitionMock.mockResolvedValue({
      schema: {
        title: "Test Form",
        type: "object",
        properties: {
          foo: {
            title: "Foo",
            description: "I am **bold**",
            type: "string",
          },
        },
      },
      uiSchema: {},
      cancelable: false,
      submitCaption: "Submit",
      location: "modal",
    });

    render(<EphemeralForm />);

    await expect(
      screen.findByRole("heading", { level: 5, name: /test form/i }),
    ).resolves.toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element.textContent === "I am bold"),
    ).toBeInTheDocument();
    expect(screen.getByRole("strong")).toHaveTextContent("bold");
  });

  it("supports markdown in form description", async () => {
    getFormDefinitionMock.mockResolvedValue({
      schema: {
        title: "Test Form",
        description: "I am **bold**",
        type: "object",
        properties: {},
      },
      uiSchema: {},
      cancelable: false,
      submitCaption: "Submit",
      location: "modal",
    });

    render(<EphemeralForm />);

    await expect(
      screen.findByRole("heading", { level: 5, name: /test form/i }),
    ).resolves.toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element.textContent === "I am bold"),
    ).toBeInTheDocument();
    expect(screen.getByRole("strong")).toHaveTextContent("bold");
  });

  it("renders a text input with inputmode numeric in place of a number input", async () => {
    getFormDefinitionMock.mockResolvedValue({
      schema: {
        title: "Test Form",
        type: "object",
        properties: {
          rating: { type: "number", title: "Rating" },
        },
      },
      uiSchema: {},
      cancelable: false,
      submitCaption: "Submit",
      location: "modal",
    });

    render(<EphemeralForm />);

    await expect(
      screen.findByRole("textbox", { name: "Rating", hidden: true }),
    ).resolves.toHaveAttribute("inputmode", "numeric");

    expect(screen.queryByRole("spinButton")).not.toBeInTheDocument();
  });
});
