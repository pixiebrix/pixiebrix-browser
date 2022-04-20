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

import { selectTraceError } from "@/pageEditor/slices/runtimeSelectors";
import { selectSessionId } from "@/pageEditor/slices/sessionSelectors";
import { reportEvent } from "@/telemetry/events";
import { useEffect } from "react";
import { useSelector } from "react-redux";

function useReportTraceError() {
  const sessionId = useSelector(selectSessionId);
  const errorTraceEntry = useSelector(selectTraceError);
  const runId = errorTraceEntry?.runId ?? null;

  useEffect(() => {
    if (errorTraceEntry) {
      reportEvent("PageEditorExtensionError", {
        sessionId,
        extensionId: errorTraceEntry.extensionId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- errorTraceEntry is not required, runId is sufficient
  }, [runId, sessionId]);
}

export default useReportTraceError;
