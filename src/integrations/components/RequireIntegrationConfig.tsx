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

import React from "react";
import IntegrationDependencyField from "@/components/fields/schemaFields/integrations/IntegrationDependencyField";
import { type Schema } from "@/types/schemaTypes";
import { type SanitizedIntegrationConfig } from "@/integrations/integrationTypes";
import useSanitizedIntegrationConfigFormikAdapter from "@/integrations/useSanitizedIntegrationConfigFormikAdapter";
import extractIntegrationIdsFromSchema from "@/integrations/util/extractIntegrationIdsFromSchema";
import useAsyncState from "@/hooks/useAsyncState";
import { validateIntegrationAuth } from "@/integrations/util/validateIntegrationAuth";

type ConfigProps = {
  integrationFieldSchema: Schema;
  integrationFieldName: string;
  children: (childProps: {
    sanitizedConfig: SanitizedIntegrationConfig;
  }) => React.ReactElement;
};

/**
 * Gate component that presents an integration dependency field, and then gates the child components
 * on the user selecting an authentication option for the integration, in the formik context.
 *
 * @param integrationFieldSchema The schema for the integration dependency field
 * @param integrationFieldName The formik field path of the integration dependency field
 * @param children A function that takes the sanitized integration config and returns the child components
 */
const RequireIntegrationConfig: React.FC<ConfigProps> = ({
  integrationFieldSchema,
  integrationFieldName,
  children,
}) => {
  const integrationIds = extractIntegrationIdsFromSchema(
    integrationFieldSchema,
  );
  const { data: sanitizedConfig } = useSanitizedIntegrationConfigFormikAdapter(
    integrationIds,
    integrationFieldName,
  );

  const { data: isConfigValid = true } = useAsyncState(async () => {
    if (sanitizedConfig == null) {
      return true;
    }

    return validateIntegrationAuth(sanitizedConfig);
  }, [sanitizedConfig]);

  return (
    <>
      <IntegrationDependencyField
        label="Integration"
        name={integrationFieldName}
        schema={integrationFieldSchema}
        isAuthInvalid={!isConfigValid}
      />
      {sanitizedConfig && isConfigValid && children({ sanitizedConfig })}
    </>
  );
};

export default RequireIntegrationConfig;
