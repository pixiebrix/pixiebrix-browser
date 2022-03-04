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

import { TraceError } from "@/telemetry/trace";
import { FormikErrorTree } from "@/pageEditor/tabs/editTab/editTabTypes";

function applyTraceBlockError(
  pipelineErrors: FormikErrorTree,
  errorTraceEntry: TraceError,
  blockIndex: number
) {
  // eslint-disable-next-line security/detect-object-injection
  if (!pipelineErrors[blockIndex]) {
    // eslint-disable-next-line security/detect-object-injection
    pipelineErrors[blockIndex] = errorTraceEntry.error.message as string;
  }
}

export default applyTraceBlockError;
