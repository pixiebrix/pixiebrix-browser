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

import React from "react";
import SelectWidget, {
  type Option,
  type SelectLike,
} from "@/components/form/widgets/SelectWidget";
import { type SanitizedServiceConfiguration } from "@/core";
import { type AsyncState, useAsyncState } from "@/hooks/common";
import { type CustomFieldWidgetProps } from "@/components/form/FieldTemplate";
import isPromise from "is-promise";
import useReportError from "@/hooks/useReportError";
import { BusinessError } from "@/errors/businessErrors";
import { Button } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSync } from "@fortawesome/free-solid-svg-icons";
import { type UnknownObject } from "@/types";

export type OptionsFactory<T = unknown> = (
  config: SanitizedServiceConfiguration,
  factoryArgs?: UnknownObject
) => Promise<Array<Option<T>>>;

type RemoteSelectWidgetProps<T = unknown> = CustomFieldWidgetProps<
  T,
  SelectLike<Option<T>>
> & {
  isClearable?: boolean;
  optionsFactory: OptionsFactory<T> | Promise<Array<Option<T>>>;
  config: SanitizedServiceConfiguration | null;
  factoryArgs?: UnknownObject;
  loadingMessage?: string;
};

export function useOptionsResolver<T>(
  config: SanitizedServiceConfiguration,
  optionsFactory: OptionsFactory<T> | Promise<Array<Option<T>>>,
  factoryArgs: UnknownObject
): AsyncState<Array<Option<T>>> {
  return useAsyncState<Array<Option<T>>>(async () => {
    if (isPromise(optionsFactory)) {
      console.debug("Options is a promise, returning promise directly");
      return optionsFactory;
    }

    if (config) {
      console.debug("Options is a factory, fetching options with config", {
        config,
      });
      return optionsFactory(config, factoryArgs);
    }

    throw new BusinessError("No integration configured");
  }, [config, optionsFactory, factoryArgs]);
}

/**
 * Widget for selecting values retrieved from a 3rd party API
 */
const RemoteSelectWidget: React.FC<RemoteSelectWidgetProps> = ({
  config,
  optionsFactory,
  factoryArgs,
  ...selectProps
}) => {
  const [options, isLoading, error, refreshOptions] = useOptionsResolver(
    config,
    optionsFactory,
    factoryArgs
  );

  useReportError(error);

  return (
    <div className="d-flex">
      <div className="flex-grow-1">
        <SelectWidget
          options={options}
          isLoading={isLoading}
          loadError={error}
          {...selectProps}
        />
      </div>

      {!isPromise(optionsFactory) && (
        <div>
          <Button onClick={refreshOptions} variant="info" title="Refresh">
            <FontAwesomeIcon icon={faSync} />
          </Button>
        </div>
      )}
    </div>
  );
};

export default RemoteSelectWidget;
