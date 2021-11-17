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

import React, { useMemo } from "react";
import { Card } from "react-bootstrap";
import { RecipeDefinition } from "@/types/definitions";
import genericOptionsFactory from "@/components/fields/schemaFields/genericOptionsFactory";
import FieldRuntimeContext, {
  RuntimeContext,
} from "@/components/fields/schemaFields/FieldRuntimeContext";

// Use "v2" because the service configuration form expects literal values for everything. (I.e., expressions are not
// supports). But we still want to get our SchemaField support for enums, etc.
const OPTIONS_FIELD_RUNTIME_CONTEXT: RuntimeContext = {
  apiVersion: "v2",
};

export interface OptionsBodyProps {
  blueprint: Pick<RecipeDefinition, "options">;
}

const OptionsBody: React.FunctionComponent<OptionsBodyProps> = ({
  blueprint,
}) => {
  const OptionsGroup = useMemo(
    () =>
      genericOptionsFactory(
        blueprint.options.schema,
        blueprint.options.uiSchema
      ),
    [blueprint.options.schema, blueprint.options.uiSchema]
  );
  return (
    <>
      <Card.Body className="px-3 py-3">
        <Card.Title>Personalize Blueprint</Card.Title>
      </Card.Body>
      <Card.Body className="OptionsBody p-3">
        <FieldRuntimeContext.Provider value={OPTIONS_FIELD_RUNTIME_CONTEXT}>
          <OptionsGroup name="optionsArgs" />
        </FieldRuntimeContext.Provider>
      </Card.Body>
    </>
  );
};

export default OptionsBody;
