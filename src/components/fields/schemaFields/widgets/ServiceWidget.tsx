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

import React, { type ChangeEvent, useCallback, useMemo } from "react";
import { type SchemaFieldProps } from "@/components/fields/schemaFields/propTypes";
import { PACKAGE_REGEX } from "@/types/helpers";
import { type AuthOption } from "@/auth/authTypes";
import {
  keyToFieldValue,
  produceExcludeUnusedDependencies,
  type ServiceSlice,
} from "@/components/fields/schemaFields/serviceFieldUtils";
import { produce } from "immer";
import { setIn, useField, useFormikContext } from "formik";
import { useAuthOptions } from "@/hooks/auth";
import { extractServiceIds } from "@/services/serviceUtils";
import { isEmpty, isEqual } from "lodash";
import {
  type SelectLike,
  type SelectWidgetOnChange,
} from "@/components/form/widgets/SelectWidget";
import ServiceSelectWidget from "@/components/fields/schemaFields/widgets/ServiceSelectWidget";
import {
  type Expression,
  type OutputKey,
  type ServiceVarRef,
} from "@/types/runtimeTypes";
import { type RegistryId } from "@/types/registryTypes";
import { type SafeString, type UUID } from "@/types/stringTypes";
import { type IntegrationDependency } from "@/types/integrationTypes";
import { fallbackValue } from "@/utils/asyncStateUtils";
import { freshIdentifier } from "@/utils/variableUtils";
import useAsyncEffect from "use-async-effect";

export type ServiceWidgetProps = SchemaFieldProps & {
  /** Set the value of the field on mount to the service already selected, or the only available credential (default=true) */
  detectDefault?: boolean;
};

const DEFAULT_SERVICE_OUTPUT_KEY = "service" as OutputKey;

export function defaultOutputKey(
  serviceId: RegistryId | null,
  otherOutputKeys: OutputKey[]
): OutputKey {
  let rawKey = DEFAULT_SERVICE_OUTPUT_KEY;

  if (serviceId) {
    const match = PACKAGE_REGEX.exec(serviceId);
    rawKey = (match.groups.collection?.replace(".", "_").replace("-", "_") ??
      DEFAULT_SERVICE_OUTPUT_KEY) as OutputKey;
  }

  // OK to cast to SafeString since defaultOutputKey checks it's a valid PACKAGE_REGEX
  return freshIdentifier(
    rawKey as unknown as SafeString,
    otherOutputKeys
  ) as OutputKey;
}

/**
 * Return the auth id corresponding to a service variable usage
 * @see AuthOption.value
 * @see IntegrationDependency.config
 */
function lookupAuthId(
  dependencies: IntegrationDependency[],
  authOptions: AuthOption[],
  value: ServiceVarRef
): UUID {
  const dependency =
    value == null
      ? null
      : dependencies.find(
          (x) => keyToFieldValue(x.outputKey).__value__ === value
        );

  return dependency == null
    ? null
    : authOptions.find((x) => x.value === dependency.config)?.value;
}

/**
 * Key assumptions/limitations:
 * - We're only supporting one service of each type at this time. If you change one of the auths for a service, it will
 * change the other auths for that service too
 */
function setServiceSelectionForField(
  state: ServiceSlice,
  fieldName: string,
  serviceId: UUID,
  options: AuthOption[]
): ServiceSlice {
  const option = options.find((x) => x.value === serviceId);

  let outputKey: OutputKey;

  let nextState = produce(state, (draft) => {
    // Unlike when defaulting, we don't need to check against the registry ids from the schema because this method
    // will only be called with an allowed option.
    const match = draft.services.find(
      (dependency) => dependency.id === option.serviceId
    );

    if (match) {
      console.debug(
        "Dependency already exists for %s, switching service auth",
        option.serviceId,
        { state }
      );
      match.id = option.serviceId;
      match.config = option.value;
      outputKey = match.outputKey;
    } else {
      console.debug(
        "Dependency does not exist for %s, creating dependency",
        option.serviceId,
        { state }
      );
      outputKey = defaultOutputKey(
        option.serviceId,
        draft.services.map((x) => x.outputKey)
      );
      draft.services.push({
        id: option.serviceId,
        outputKey,
        config: option.value,
      });
    }
  });

  // Update field value before calling produceExcludeUnusedDependencies, otherwise it will see the stale service var
  nextState = setIn(nextState, fieldName, keyToFieldValue(outputKey));

  // Perform cleanup of the service dependencies
  nextState = produceExcludeUnusedDependencies(nextState);

  return nextState;
}

function clearIntegrationSelection(
  state: ServiceSlice,
  fieldName: string
): ServiceSlice {
  const nextState = setIn(state, fieldName, null);
  return produceExcludeUnusedDependencies(nextState);
}

const NO_AUTH_OPTIONS = Object.freeze([] as AuthOption[]);

/**
 * A schema-driven Service Selector that automatically maintains the services form state (and output keys)
 * @see IntegrationDependency
 */
const ServiceWidget: React.FC<ServiceWidgetProps> = ({
  detectDefault = true,
  ...props
}) => {
  const { schema } = props;
  const { data: authOptions, refetch: refreshOptions } = fallbackValue(
    useAuthOptions(),
    NO_AUTH_OPTIONS
  );
  const { values: root, setValues: setRootValues } =
    useFormikContext<ServiceSlice>();
  const [{ value, ...field }, , helpers] =
    useField<Expression<ServiceVarRef>>(props);

  const { validDefaultServiceIds, options } = useMemo(() => {
    // Registry ids specified by the schema, or returns empty if any allowed
    const schemaServiceIds = extractServiceIds(schema);

    return {
      validDefaultServiceIds: schemaServiceIds,
      options: isEmpty(schemaServiceIds)
        ? authOptions
        : authOptions.filter((x) => schemaServiceIds.includes(x.serviceId)),
    };
  }, [authOptions, schema]);

  const onChange: SelectWidgetOnChange<AuthOption> = useCallback(
    async ({ target: { value, options } }) => {
      // Value will be null when the selection is "cleared"
      const newState =
        value == null
          ? clearIntegrationSelection(root, field.name)
          : setServiceSelectionForField(root, field.name, value, options);
      await setRootValues(newState);
      // eslint-disable-next-line unicorn/no-useless-undefined -- need to clear the error
      helpers.setError(undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- formik helpers change on every render
    [root, setRootValues, field.name]
  );

  useAsyncEffect(
    async () => {
      if (value == null && detectDefault) {
        if (root.services == null) {
          throw new TypeError(
            "services prop does not exist on base form state. Is your Formik state configured properly?"
          );
        }

        // Match a permitted service id that's already configured by another brick
        const match = root.services.find((service) =>
          validDefaultServiceIds.includes(service.id)
        );

        if (match?.outputKey) {
          // If the service is already being used, default to the currently configured auth
          console.debug(
            "Dependency already exists for %s, using output key %s",
            match.id,
            match.outputKey,
            { root, match }
          );
          await helpers.setValue(keyToFieldValue(match.outputKey));
        } else if (options.length === 1) {
          // This condition is only true when the auth services have been filtered by the schema

          console.debug("Defaulting to only integration option", {
            option: options[0],
            options,
          });
          // Try defaulting to the only option available. Use onChange instead of helpers.setValue b/c it automatically
          // updates the services part of the form state
          onChange({
            target: { value: options[0].value, name: field.name, options },
          } as ChangeEvent<SelectLike<AuthOption>>);
        }
      } else if (
        value &&
        !root.services.some((service) =>
          isEqual(keyToFieldValue(service.outputKey), value)
        )
      ) {
        // This currently happens when a brick is copy-pasted into a separate extension
        // that does not yet have root.services configured, but already has the service
        // key set up in the (copied) BrickConfig. Clearing the value here allows the
        // preceding if-branch to execute again, which runs the "detectDefault" logic
        // and then calls the service-select change handler, which in turn will configure
        // root.services properly for the extension.
        await helpers.setValue(null);
      }
    },
    // Only run on mount
    [validDefaultServiceIds, options]
  );

  // The SelectWidget re-looks up the option based on the value
  const selectedValue = useMemo(
    () =>
      value?.__value__
        ? lookupAuthId(root.services, authOptions, value.__value__)
        : null,
    [authOptions, root.services, value?.__value__]
  );

  return (
    <ServiceSelectWidget
      name={field.name}
      id={field.name}
      value={selectedValue}
      onChange={onChange}
      options={options}
      refreshOptions={refreshOptions}
      isClearable
    />
  );
};

export default ServiceWidget;
