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

import { type SchemaFieldProps } from "@/components/fields/schemaFields/propTypes";
import { joinName } from "@/utils";
import { type DocumentElementType } from "@/components/documentBuilder/documentBuilderTypes";
import React from "react";
import { VALID_HEADER_TAGS } from "@/components/documentBuilder/allowedElementTypes";

function getClassNameEdit(elementName: string): SchemaFieldProps {
  return {
    name: joinName(elementName, "config", "className"),
    schema: { type: "string", format: "bootstrap-class" },
    label: "Layout/Style",
  };
}

function getHiddenEdit(elementName: string): SchemaFieldProps {
  return {
    name: joinName(elementName, "config", "hidden"),
    // Allow any to permit truthy values like for other conditional fields
    schema: { type: ["string", "boolean", "null", "number"] },
    label: "Hidden",
    description: (
      <p>
        Condition determining whether to hide the element. Truthy string values
        are&nbsp;
        <code>true</code>, <code>t</code>, <code>yes</code>, <code>y</code>,{" "}
        <code>on</code>, and <code>1</code> (case-insensitive)
      </p>
    ),
  };
}

function getElementEditSchemas(
  elementType: DocumentElementType,
  elementName: string
): SchemaFieldProps[] {
  switch (elementType) {
    // Provide backwards compatibility for old elements
    case "header_1":
    case "header_2":
    case "header_3": {
      const titleEdit: SchemaFieldProps = {
        name: joinName(elementName, "config", "title"),
        schema: { type: "string" },
        label: "Title",
      };
      return [
        titleEdit,
        getHiddenEdit(elementName),
        getClassNameEdit(elementName),
      ];
    }

    case "header": {
      const titleEdit: SchemaFieldProps = {
        name: joinName(elementName, "config", "title"),
        schema: { type: "string" },
        label: "Title",
      };
      const heading: SchemaFieldProps = {
        name: joinName(elementName, "config", "heading"),
        schema: {
          type: "string",
          enum: VALID_HEADER_TAGS,
          format: "heading-style",
        },
        label: "Heading",
        isRequired: true,
      };
      return [
        titleEdit,
        heading,
        getHiddenEdit(elementName),
        getClassNameEdit(elementName),
      ];
    }

    case "text": {
      const textEdit: SchemaFieldProps = {
        name: joinName(elementName, "config", "text"),
        schema: { type: "string" },
        label: "Text",
      };
      const enableMarkdown: SchemaFieldProps = {
        name: joinName(elementName, "config", "enableMarkdown"),
        schema: { type: "boolean" },
        label: "Enable markdown",
        isRequired: true,
      };
      return [
        textEdit,
        enableMarkdown,
        getHiddenEdit(elementName),
        getClassNameEdit(elementName),
      ];
    }

    case "image": {
      const imageUrl: SchemaFieldProps = {
        name: joinName(elementName, "config", "url"),
        schema: { type: "string", format: "uri" },
        label: "Image URL",
      };
      const height: SchemaFieldProps = {
        name: joinName(elementName, "config", "height"),
        schema: { type: ["string", "number"] },
        label: "Height",
      };
      const width: SchemaFieldProps = {
        name: joinName(elementName, "config", "width"),
        schema: { type: ["string", "number"] },
        label: "Width",
      };
      return [
        imageUrl,
        height,
        width,
        getHiddenEdit(elementName),
        getClassNameEdit(elementName),
      ];
    }

    case "card": {
      const headingEdit: SchemaFieldProps = {
        name: joinName(elementName, "config", "heading"),
        schema: { type: "string" },
        label: "Heading",
      };
      return [
        headingEdit,
        getHiddenEdit(elementName),
        getClassNameEdit(elementName),
      ];
    }

    case "pipeline": {
      throw new Error("Use custom Options for pipeline element.");
    }

    case "button": {
      const titleEdit: SchemaFieldProps = {
        name: joinName(elementName, "config", "title"),
        schema: { type: "string" },
        label: "Title",
        description: "The text to display on the button.",
      };
      const variantEdit: SchemaFieldProps = {
        name: joinName(elementName, "config", "variant"),
        schema: {
          type: "string",
          enum: [
            "primary",
            "secondary",
            "success",
            "warning",
            "danger",
            "info",
            "light",
            "dark",
            "link",
            "outline-primary",
            "outline-secondary",
            "outline-success",
            "outline-warning",
            "outline-danger",
            "outline-info",
            "outline-light",
            "outline-dark",
            "outline-link",
          ],
        },
        label: "Variant",
      };
      const sizeEdit: SchemaFieldProps = {
        name: joinName(elementName, "config", "size"),
        schema: { type: "string", enum: ["lg", "md", "sm"] },
        label: "Size",
      };
      const disabledEdit: SchemaFieldProps = {
        name: joinName(elementName, "config", "disabled"),
        // Allow any to permit truthy values like for other conditional fields
        schema: { type: ["string", "boolean", "null", "number"] },
        label: "Disabled",
      };
      return [
        titleEdit,
        variantEdit,
        sizeEdit,
        disabledEdit,
        getHiddenEdit(elementName),
        getClassNameEdit(elementName),
      ];
    }

    case "list": {
      throw new Error("Use custom Options for list element.");
    }

    default: {
      return [getHiddenEdit(elementName), getClassNameEdit(elementName)];
    }
  }
}

export default getElementEditSchemas;
