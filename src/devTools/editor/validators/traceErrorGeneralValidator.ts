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

import { TraceError } from "@/telemetry/trace";

function traceErrorGeneralValidator(
  pipelineErrors: Record<string, unknown>,
  errorTraceEntry: TraceError,
  blockIndex: number
): boolean {
  const blockIndexString = String(blockIndex);
  // eslint-disable-next-line security/detect-object-injection
  if (!pipelineErrors[blockIndexString]) {
    // eslint-disable-next-line security/detect-object-injection
    pipelineErrors[blockIndexString] = errorTraceEntry.error.message;
    return true;
  }

  return false;
}

export default traceErrorGeneralValidator;
