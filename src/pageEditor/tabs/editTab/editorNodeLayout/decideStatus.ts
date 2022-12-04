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

import { RunStatus } from "@/pageEditor/tabs/editTab/editTabTypes";
import { type TraceRecord } from "@/telemetry/trace";
import { type Annotation, AnnotationType } from "@/analysis/analysisTypes";

type DecideBlockStatusArgs = {
  blockAnnotations: Annotation[];
  traceRecord: TraceRecord;
};

export function decideBlockStatus({
  blockAnnotations,
  traceRecord,
}: DecideBlockStatusArgs): RunStatus {
  if (
    blockAnnotations.some(
      (annotation) => annotation.type === AnnotationType.Error
    )
  ) {
    return RunStatus.ERROR;
  }

  if (
    blockAnnotations.some(
      (annotation) => annotation.type === AnnotationType.Warning
    )
  ) {
    return RunStatus.WARNING;
  }

  if (traceRecord == null) {
    return RunStatus.NONE;
  }

  if (traceRecord?.skippedRun) {
    return RunStatus.SKIPPED;
  }

  if (traceRecord.isFinal) {
    return RunStatus.SUCCESS;
  }

  return RunStatus.PENDING;
}

type DecideFoundationStatusArgs = {
  hasTraces: boolean;
  blockAnnotations: Annotation[];
};
export function decideFoundationStatus({
  hasTraces,
  blockAnnotations,
}: DecideFoundationStatusArgs): RunStatus {
  if (
    blockAnnotations.some(
      (annotation) => annotation.type === AnnotationType.Error
    )
  ) {
    return RunStatus.ERROR;
  }

  if (
    blockAnnotations.some(
      (annotation) => annotation.type === AnnotationType.Warning
    )
  ) {
    return RunStatus.WARNING;
  }

  // The runtime doesn't directly trace the extension point. However, if there's a trace from a brick, we
  // know the extension point ran successfully
  if (hasTraces) {
    return RunStatus.SUCCESS;
  }

  return RunStatus.NONE;
}
