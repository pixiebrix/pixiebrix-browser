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

import { useSelector } from "react-redux";
import { selectTraceError } from "@/devTools/editor/slices/runtimeSelectors";
import { useCallback } from "react";
import { BlockPipeline } from "@/blocks/types";
import { useField, useFormikContext, setNestedObjectValues } from "formik";
import { TraceError } from "@/telemetry/trace";
import { isInputValidationError } from "@/blocks/errors";
import { OutputUnit } from "@cfworker/json-schema";
import { useAsyncEffect } from "use-async-effect";
import { joinName } from "@/utils";
import { set } from "lodash";

const REQUIRED_FIELD_REGEX = /^Instance does not have required property "(?<property>.+)"\.$/;

function usePipelineField(): {
  blockPipeline: BlockPipeline;
  blockPipelineErrors: unknown[];
  setBlockPipeline: (value: BlockPipeline, shouldValidate: boolean) => void;
  traceError: TraceError;
} {
  const traceError = useSelector(selectTraceError);

  const validatePipelineBlocks = useCallback(
    (pipeline: BlockPipeline) => {
      if (!traceError) {
        return;
      }

      const { error, blockInstanceId } = traceError;
      const blockIndex = pipeline.findIndex(
        (block) => block.instanceId === blockInstanceId
      );
      if (blockIndex === -1) {
        return;
      }

      const errors: Record<string, unknown> = {};
      if (isInputValidationError(error)) {
        for (const unit of (error.errors as unknown) as OutputUnit[]) {
          let propertyNameInPipeline: string;
          let errorMessage: string;

          const property = REQUIRED_FIELD_REGEX.exec(unit.error)?.groups
            .property;
          if (property) {
            propertyNameInPipeline = joinName(
              String(blockIndex),
              "config",
              property
            );
            errorMessage = "Error from the last run: This field is required";
          } else {
            propertyNameInPipeline = String(blockIndex);
            errorMessage = error.message;
          }

          set(errors, propertyNameInPipeline, errorMessage);
        }
      } else {
        // eslint-disable-next-line security/detect-object-injection
        errors[blockIndex] = error.message;
      }

      return errors;
    },
    [traceError]
  );

  const formikField = useField<BlockPipeline>({
    name: "extension.blockPipeline",
    // @ts-expect-error working with nested errors
    validate: validatePipelineBlocks,
  });

  const formikContext = useFormikContext();
  useAsyncEffect(
    async (isMounted) => {
      const validationErrors = await formikContext.validateForm();
      if (!isMounted()) {
        return;
      }

      if (Object.keys(validationErrors).length > 0) {
        formikContext.setTouched(setNestedObjectValues(validationErrors, true));
      }
    },
    [traceError]
  );

  return {
    blockPipeline: formikField[0].value,
    blockPipelineErrors: (formikField[1].error as unknown) as unknown[],
    setBlockPipeline: formikField[2].setValue,
    traceError,
  };
}

export default usePipelineField;
