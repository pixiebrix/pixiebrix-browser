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

import { loadBrickYaml } from "@/runtime/brickYaml";
import { waitForEffect } from "@/testUtils/testHelpers";
import { render, screen, within } from "@testing-library/react";
import React from "react";
import blockRegistry from "@/bricks/registry";
import { MarkdownRenderer } from "@/bricks/renderers/markdown";
import * as contentScriptAPI from "@/contentScript/messenger/api";
import { UNSET_UUID, uuidv4 } from "@/types/helpers";
import { buildDocumentBranch } from "./documentTree";
import {
  type DocumentElement,
  type DocumentElementType,
} from "./documentBuilderTypes";
import DocumentContext, {
  initialValue,
} from "@/components/documentBuilder/render/DocumentContext";

// Mock the recordX trace methods. Otherwise, they'll fail and Jest will have unhandled rejection errors since we call
// them with `void` instead of awaiting them in the reducePipeline methods
jest.mock("@/contentScript/messenger/api");

const markdownBlock = new MarkdownRenderer();

describe("When rendered in panel", () => {
  beforeEach(() => {
    blockRegistry.clear();
    blockRegistry.register([markdownBlock]);
  });

  const renderDocument = (config: DocumentElement) => {
    const branch = buildDocumentBranch(config, {
      staticId: "body",
      branches: [],
    });

    const { Component, props } = branch ?? {};
    const children = Component ? <Component {...props} /> : null;

    return render(
      <DocumentContext.Provider
        value={{
          ...initialValue,
          meta: {
            extensionId: UNSET_UUID,
            runId: UNSET_UUID,
          },
        }}
      >
        {children}
      </DocumentContext.Provider>
    );
  };

  test.each`
    type          | tagName
    ${"header_1"} | ${"h1"}
    ${"header_2"} | ${"h2"}
    ${"header_3"} | ${"h3"}
  `(
    "renders $tagName for $type",
    ({ type, tagName }: { type: DocumentElementType; tagName: string }) => {
      const config = {
        type,
        config: {
          title: "Test Header",
          className: "test-class",
        },
      };
      renderDocument(config);

      const element = screen.getByRole("heading", {
        level: Number(tagName.replace("h", "")),
      });

      expect(element).toBeInTheDocument();
      expect(element).toHaveClass("test-class");
      expect(element).toHaveTextContent("Test Header");
    }
  );

  test.each([1, 2, 3, 4, 5, 6])("renders tag for h%d", (headerLevel) => {
    renderDocument({
      type: "header",
      config: {
        title: "Test Header",
        heading: `h${headerLevel}`,
      },
    });

    const element = screen.getByRole("heading", { level: headerLevel });

    expect(element).not.toBeNull();
    expect(element).toHaveTextContent("Test Header");
  });

  test("renders paragraph text", () => {
    const config: DocumentElement = {
      type: "text",
      config: {
        text: "Test Paragraph",
        className: "test-class",
      },
    };
    renderDocument(config);

    const element = screen.getByText("Test Paragraph");

    expect(element).not.toBeNull();
    expect(element).toHaveClass("test-class");
  });

  test("does not render hidden element at root", () => {
    const text = "Test Paragraph";
    const config: DocumentElement = {
      type: "text",
      config: {
        text,
        className: "test-class",
        hidden: true,
      },
    };
    renderDocument(config);

    expect(screen.queryByText(text)).toBeNull();
  });

  test("renders markdown", () => {
    const config: DocumentElement = {
      type: "text",
      config: {
        text: "Test ~~Paragraph~~",
        enableMarkdown: true,
        className: "test-class",
      },
    };
    const { asFragment } = renderDocument(config);
    expect(asFragment()).toMatchSnapshot();
  });

  test("renders unknown type", () => {
    const config: DocumentElement = {
      // @ts-expect-error testing with invalid type
      type: "TheTypeForWhichAComponentIsNotDefined",
      className: "test-class",
    };
    renderDocument(config);

    expect(
      screen.getByText(
        /unknown component type: thetypeforwhichacomponentisnotdefined/i
      )
    ).toBeInTheDocument();
  });

  test("renders grid", () => {
    const config = {
      type: "container",
      config: {
        className: "container-test-class",
      },
      children: [
        {
          type: "row",
          children: [
            {
              type: "column",
              children: [
                {
                  type: "header_1",
                  config: {
                    title: "Header",
                  },
                },
              ],
            },
          ],
        },
        {
          type: "row",
          config: {
            className: "row-test-class",
          },
          children: [
            {
              type: "column",
              config: {
                className: "column-test-class",
              },
              children: [
                {
                  type: "text",
                  config: {
                    text: "left column",
                  },
                },
              ],
            },
            {
              type: "column",
              children: [
                {
                  type: "text",
                  config: {
                    text: "right column",
                  },
                },
              ],
            },
          ],
        },
      ],
    } as DocumentElement;

    renderDocument(config);

    const bsContainer = screen.getByTestId("container");
    expect(bsContainer).not.toBeNull();
    expect(bsContainer).toHaveClass("container-test-class");

    const rows = screen.getAllByTestId("row");
    expect(rows).toHaveLength(2);

    // First row should have 1 column with h1
    const firstRowColumn = within(rows[0]).getByTestId("column");
    expect(firstRowColumn).toBeInTheDocument();
    expect(
      within(firstRowColumn).getByRole("heading", { level: 1 })
    ).toBeInTheDocument();

    // Second row should have a class and 2 columns
    const secondRow = rows[1];
    expect(secondRow).toHaveClass("row-test-class");
    const columns = within(secondRow).getAllByTestId("column");
    expect(columns).toHaveLength(2);
    expect(columns[0]).toHaveClass("column-test-class");
    expect(within(columns[0]).getByText(/left column/i)).toBeInTheDocument();
    expect(within(columns[1]).getByText(/right column/i)).toBeInTheDocument();
  });

  describe("button", () => {
    test("renders button", () => {
      const config: DocumentElement = {
        type: "button",
        config: {
          title: "Button under test",
          variant: "primary",
          className: "test-class",
          onClick: {
            __type__: "pipeline",
            __value__: jest.fn(),
          },
        },
      };
      renderDocument(config);
      const element = screen.getByRole("button");

      expect(element).not.toBeNull();
      expect(element).toHaveClass("test-class");
      expect(element).toHaveTextContent("Button under test");
      expect(element).not.toBeDisabled();
    });

    test("renders full width button", () => {
      const config: DocumentElement = {
        type: "button",
        config: {
          title: "Button under test",
          fullWidth: true,
          onClick: {
            __type__: "pipeline",
            __value__: jest.fn(),
          },
        },
      };
      renderDocument(config);
      const element = screen.getByRole("button");

      expect(element).toHaveClass("btn-block");
    });

    test.each`
      variant        | className
      ${"primary"}   | ${"btn-primary"}
      ${"secondary"} | ${"btn-secondary"}
      ${"link"}      | ${"btn-link"}
    `(
      "applies button variant: $variant",
      ({ variant, className }: { variant: string; className: string }) => {
        const config: DocumentElement = {
          type: "button",
          config: {
            title: "Button under test",
            variant,
            onClick: {
              __type__: "pipeline",
              __value__: jest.fn(),
            },
          },
        };
        renderDocument(config);
        const element = screen.getByRole("button");

        expect(element).toHaveClass(className);
      }
    );

    test.each([true, "y"])("renders disabled button for %s", (disabled) => {
      const config: DocumentElement = {
        type: "button",
        config: {
          title: "Button under test",
          className: "test-class",
          disabled,
          onClick: {
            __type__: "pipeline",
            __value__: jest.fn(),
          },
        },
      };

      renderDocument(config);
      const element = screen.getByRole("button");

      expect(element).not.toBeNull();
      expect(element).toHaveClass("test-class");
      expect(element).toBeDisabled();
    });
  });

  describe("card", () => {
    test("renders card", () => {
      const config: DocumentElement = {
        type: "card",
        config: {
          className: "test-class",
          heading: "Test Heading of Card",
        },
      };
      renderDocument(config);

      const rootElement = screen.getByTestId("card");
      expect(rootElement).toBeInTheDocument();
      expect(rootElement).toHaveClass("test-class");

      const cardHeading = screen.getByTestId("card-header");
      expect(cardHeading).toHaveTextContent("Test Heading of Card");

      const cardBody = screen.getByTestId("card-body");
      expect(cardBody).toBeInTheDocument();
    });
    test("renders card children", () => {
      const config: DocumentElement = {
        type: "card",
        config: {
          className: "test-class",
          heading: "Test Heading of Card",
        },
        children: [
          {
            type: "text",
            config: {
              text: "Test body of card",
            },
          },
        ],
      };
      renderDocument(config);

      const cardBody = screen.getByTestId("card-body");
      expect(
        within(cardBody).getByText("Test body of card")
      ).toBeInTheDocument();
    });
  });

  test("renders block", async () => {
    const markdown = "Pipeline text for card test.";
    (contentScriptAPI.runRendererPipeline as jest.Mock).mockResolvedValueOnce({
      blockId: markdownBlock.id,
      key: uuidv4(),
      args: { markdown },
      ctxt: { "@input": {}, "@options": {} },
    });
    (contentScriptAPI.runMapArgs as jest.Mock).mockImplementationOnce(
      async (inputConfig) => inputConfig
    );

    const yamlConfig = `
type: pipeline
config:
  pipeline: !pipeline
    - id: "${markdownBlock.id}"
      config:
        markdown: ${markdown}`;

    const config = loadBrickYaml(yamlConfig) as DocumentElement;
    renderDocument(config);

    // Wait for useAsyncState inside the PipelineComponent
    await waitForEffect();

    const blockContainer = screen.getByTestId(markdownBlock.id);
    expect(blockContainer).toBeInTheDocument();
    expect(blockContainer).toHaveClass("full-height");
  });
});
