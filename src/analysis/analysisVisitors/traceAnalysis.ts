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

import { AnalysisVisitorABC } from "./baseAnalysisVisitors";
import { type AnalysisAnnotation } from "@/analysis/analysisTypes";
import {
  isTraceError,
  type TraceError,
  type TraceRecord,
} from "@/telemetry/trace";
import { type BrickConfig, type BrickPosition } from "@/blocks/types";
import { type UUID } from "@/types/stringTypes";
import { groupBy, isEmpty } from "lodash";
import { getErrorMessage } from "@/errors/errorHelpers";
import { isInputValidationError } from "@/blocks/errors";
import { nestedPosition, type VisitBlockExtra } from "@/blocks/PipelineVisitor";
import { type ModComponentFormState } from "@/pageEditor/extensionPoints/formStateTypes";
import { type ErrorObject } from "serialize-error";
import { AnnotationType } from "@/types/annotationTypes";

const requiredFieldRegex =
  /^Instance does not have required property "(?<property>.+)"\.$/;

const rootPropertyRegex = /^#\/(?<property>.+)$/;

class TraceAnalysis extends AnalysisVisitorABC {
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

  mapErrorAnnotations(
    position: BrickPosition,
    traceError: ErrorObject
  ): AnalysisAnnotation[] {
    const annotations: AnalysisAnnotation[] = [];

    if (isInputValidationError(traceError)) {
      for (const maybeInputError of traceError.errors) {
        const rootProperty = rootPropertyRegex.exec(
          maybeInputError.instanceLocation
        )?.groups.property;

        if (rootProperty) {
          annotations.push({
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

          annotations.push({
            position: nestedPosition(position, "config", requiredProperty),
            message: errorMessage,
            analysisId: this.id,
            type: AnnotationType.Error,
            detail: traceError,
          });
        }
      }
    }

    if (annotations.length === 0) {
      const rawMessage = getErrorMessage(traceError);
      annotations.push({
        position,
        // Avoid a blank error message if the traceError doesn't have a single message
        message: isEmpty(rawMessage)
          ? "An error occurred on the last run"
          : rawMessage,
        analysisId: this.id,
        type: AnnotationType.Error,
        detail: traceError,
      });
    }

    return annotations;
  }

  override visitBrick(
    position: BrickPosition,
    blockConfig: BrickConfig,
    extra: VisitBlockExtra
  ) {
    super.visitBrick(position, blockConfig, extra);

    const errorRecord = this.traceErrorMap.get(blockConfig.instanceId)?.at(0);
    if (errorRecord == null) {
      return;
    }

    const { error: traceError } = errorRecord;

    this.annotations.push(...this.mapErrorAnnotations(position, traceError));
  }

  override run(extension: ModComponentFormState): void {
    if (this.traceErrorMap.size === 0) {
      return;
    }

    super.run(extension);
  }
}

export default TraceAnalysis;
