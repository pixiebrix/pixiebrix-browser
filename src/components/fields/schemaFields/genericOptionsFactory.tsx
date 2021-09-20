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

import React from "react";
import { inputProperties } from "@/helpers";
import { Schema, UiSchema } from "@/core";
import { compact, isEmpty } from "lodash";
import SchemaField from "@/components/fields/schemaFields/SchemaField";

export type BlockOptionProps = {
  /**
   * The root field name for the block configuration.
   */
  name: string;

  /**
   * The property name of the block configuration -- in general this should be "config"
   * @see BlockConfig
   */
  configKey?: string;
};

/**
 * Return the Options fields for configuring a block with the given schema.
 */
function genericOptionsFactory(
  schema: Schema,
  uiSchema?: UiSchema
): React.FunctionComponent<BlockOptionProps> {
  const OptionsFields = ({ name, configKey }: BlockOptionProps) => (
    <>
      {Object.entries(inputProperties(schema)).map(([prop, fieldSchema]) => {
        if (typeof fieldSchema === "boolean") {
          throw new TypeError("Expected schema for input property type");
        }

        // Fine because coming from Object.entries for the schema
        // eslint-disable-next-line security/detect-object-injection
        const propUiSchema = uiSchema?.[prop];
        return (
          <SchemaField
            key={prop}
            name={compact([name, configKey, prop]).join(".")}
            schema={fieldSchema}
            uiSchema={propUiSchema}
          />
        );
      })}
      {isEmpty(schema) && <div>No options available</div>}
    </>
  );

  OptionsFields.displayName = "OptionsFields";
  return OptionsFields;
}

export default genericOptionsFactory;
