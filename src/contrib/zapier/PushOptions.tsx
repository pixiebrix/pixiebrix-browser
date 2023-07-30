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

import React, { useMemo } from "react";
import { type BlockOptionProps } from "@/components/fields/schemaFields/genericOptionsFactory";
import { useField } from "formik";
import { useAsyncState } from "@/hooks/common";
import { type SchemaFieldProps } from "@/components/fields/schemaFields/propTypes";
import { type Webhook } from "@/contrib/zapier/contract";
import { pixiebrixConfigurationFactory } from "@/services/locator";
import { getBaseURL } from "@/services/baseService";
import { ZAPIER_PERMISSIONS, ZAPIER_PROPERTIES } from "@/contrib/zapier/push";
import { containsPermissions, proxyService } from "@/background/messenger/api";
import AsyncButton from "@/components/AsyncButton";
import ConnectedFieldTemplate from "@/components/form/ConnectedFieldTemplate";
import SelectWidget from "@/components/form/widgets/SelectWidget";
import ObjectWidget from "@/components/fields/schemaFields/widgets/ObjectWidget";
import { defaultFieldFactory } from "@/components/fields/schemaFields/SchemaFieldContext";
import { makeLabelForSchemaField } from "@/components/fields/schemaFields/schemaFieldUtils";
import WorkshopMessageWidget from "@/components/fields/schemaFields/widgets/WorkshopMessageWidget";
import FieldTemplate from "@/components/form/FieldTemplate";
import { type Expression } from "@/types/runtimeTypes";
import { type Schema } from "@/types/schemaTypes";
import useExtensionPermissions from "@/permissions/useExtensionPermissions";
import useRequestPermissionsCallback from "@/permissions/useRequestPermissionsCallback";
import { isExpression } from "@/utils/expressionUtils";
import { joinName } from "@/utils/formUtils";

function useHooks(): {
  hooks: Webhook[];
  isPending: boolean;
  error: unknown;
} {
  const [hooks, isPending, error] = useAsyncState(async () => {
    const { data } = await proxyService<{ new_push_fields: Webhook[] }>(
      await pixiebrixConfigurationFactory(),
      {
        baseURL: await getBaseURL(),
        url: "/api/webhooks/hooks/",
        method: "get",
      }
    );

    return data.new_push_fields;
  }, []);

  return { hooks, isPending, error };
}

const ZapField: React.FunctionComponent<
  SchemaFieldProps & { hooks: Webhook[]; error: unknown }
> = ({ hooks, error, ...props }) => {
  const options = useMemo(
    () =>
      (hooks ?? []).map((x) => ({
        value: x.display_name,
        label: x.display_name,
        hook: x,
      })),
    [hooks]
  );

  return (
    <ConnectedFieldTemplate
      name={props.name}
      label={makeLabelForSchemaField(props)}
      description="The Zap to run"
      as={SelectWidget}
      blankValue={null}
      options={options}
      loadingMessage="Loading Zaps..."
      loadingError={error}
    />
  );
};

const ObjectField = defaultFieldFactory(ObjectWidget);

const PushOptions: React.FunctionComponent<BlockOptionProps> = ({
  name,
  configKey,
}) => {
  const basePath = joinName(name, configKey);

  const permissionsState = useExtensionPermissions();

  const [hasPermissions] = useAsyncState(
    async () => containsPermissions(ZAPIER_PERMISSIONS),
    [permissionsState]
  );

  const onRequestPermissions =
    useRequestPermissionsCallback(ZAPIER_PERMISSIONS);

  const [{ value: pushKey }] = useField<string | Expression>(
    `${basePath}.pushKey`
  );

  const { hooks, error } = useHooks();

  const hook = useMemo(
    () => hooks?.find((x) => x.display_name === pushKey),
    [hooks, pushKey]
  );

  if (!hasPermissions) {
    return (
      <div className="my-2">
        <p>
          You must grant permissions for you browser to send information to
          Zapier.
        </p>
        <AsyncButton onClick={onRequestPermissions}>
          Grant Permissions
        </AsyncButton>
      </div>
    );
  }

  const schema: Schema = ZAPIER_PROPERTIES.pushKey as Schema;

  return isExpression(pushKey) ? (
    <FieldTemplate
      name={`${basePath}.pushKey`}
      label="Zap"
      description={schema.description}
      as={WorkshopMessageWidget}
    />
  ) : (
    <div>
      <ZapField
        label="Zap"
        name={`${basePath}.pushKey`}
        schema={schema}
        hooks={hooks}
        error={error}
      />

      {pushKey && hook && (
        // Using ObjectField instead of ChildObjectField here to allow for additionalProperties.
        <ObjectField name={`${basePath}.data`} schema={hook.input_schema} />
      )}
    </div>
  );
};

export default PushOptions;
