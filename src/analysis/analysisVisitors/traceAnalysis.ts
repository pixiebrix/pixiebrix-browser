/*
 * Copyright (C) 2022 PixieBrix, Inc.
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

import { AnalysisVisitor } from "./baseAnalysisVisitors";
import { AnnotationType } from "@/analysis/analysisTypes";
import { isTraceError, TraceError, TraceRecord } from "@/telemetry/trace";
import { BlockConfig, BlockPosition } from "@/blocks/types";
import { UUID } from "@/core";
import { groupBy } from "lodash";
import { getErrorMessage } from "@/errors/errorHelpers";
import { isInputValidationError } from "@/blocks/errors";
import { nestedPosition, VisitBlockExtra } from "@/blocks/PipelineVisitor";
import { FormState } from "@/pageEditor/extensionPoints/formStateTypes";

const requiredFieldRegex =
  /^Instance does not have required property "(?<property>.+)"\.$/;

const rootPropertyRegex = /^#\/(?<property>.+)$/;

class TraceAnalysis extends AnalysisVisitor {
  get id() {
    return "trace";
  }

  private readonly traceErrorMap = new Map<UUID, TraceError[]>();

  /**
   * @param trace the trace for the latest run of the extension
   */
  constructor(trace: TraceRecord[]) {
    super();

    for (const [instanceId, records] of Object.entries(
      // eslint-disable-next-line unicorn/no-array-callback-reference -- a proxy function breaks the type inference of isTraceError
      groupBy(trace.filter(isTraceError), (x) => x.blockInstanceId)
    )) {
      this.traceErrorMap.set(instanceId as UUID, records);
    }
  }

  override visitBlock(
    position: BlockPosition,
    blockConfig: BlockConfig,
    extra: VisitBlockExtra
  ) {
    super.visitBlock(position, blockConfig, extra);

    const errorRecord = this.traceErrorMap.get(blockConfig.instanceId)?.at(0);
    if (errorRecord == null) {
      return;
    }

    const { error: traceError } = errorRecord;

    if (isInputValidationError(traceError)) {
      for (const maybeInputError of traceError.errors) {
        const rootProperty = rootPropertyRegex.exec(
          maybeInputError.instanceLocation
        )?.groups.property;
        if (rootProperty) {
          this.annotations.push({
            position: nestedPosition(position, "config", rootProperty),
            message: getErrorMessage(maybeInputError.error),
            analysisId: this.id,
            type: AnnotationType.Error,
            detail: traceError,
          });
          continue;
        }

        const requiredProperty = requiredFieldRegex.exec(maybeInputError.error)
          ?.groups.property;
        if (requiredProperty) {
          const errorMessage =
            "Error from the last run: This field is required.";

          this.annotations.push({
            position: nestedPosition(position, "config", requiredProperty),
            message: errorMessage,
            analysisId: this.id,
            type: AnnotationType.Error,
            detail: traceError,
          });
        }
      }
    } else {
      this.annotations.push({
        position,
        message: getErrorMessage(traceError),
        analysisId: this.id,
        type: AnnotationType.Error,
        detail: traceError,
      });
    }
  }

  override run(extension: FormState): void {
    if (this.traceErrorMap.size === 0) {
      return;
    }

    super.run(extension);
  }
}

export default TraceAnalysis;
