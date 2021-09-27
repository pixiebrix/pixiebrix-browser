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

import { getLatestRunByExtensionId } from "@/telemetry/trace";
import useInterval from "@/hooks/useInterval";
import { useDispatch, useSelector } from "react-redux";
import runtimeSlice, {
  selectRunId,
} from "@/devTools/editor/slices/runtimeSlice";
import { selectActiveExtension } from "@/devTools/editor/slices/editorSelectors";
import { selectExtensionTrace } from "@/devTools/editor/slices/runtimeSelectors";

const { setExtensionTrace } = runtimeSlice.actions;

const TRACE_RELOAD_MILLIS = 350;

/**
 * Hook that refreshes the trace information in the Redux store
 */
function useExtensionTrace() {
  const dispatch = useDispatch();
  // XXX: should this use the Formik state to get the extension id instead? In practice they should always be in sync
  const extensionId = useSelector(selectActiveExtension);
  const extensionTrace = useSelector(selectExtensionTrace);

  const refreshTrace = async () => {
    const records = await getLatestRunByExtensionId(extensionId);
    // Keep the Redux log clean. Don't setExtensionTrace unless we have to
    if (selectRunId(records) !== selectRunId(extensionTrace)) {
      dispatch(setExtensionTrace({ extensionId, records }));
    }
  };

  useInterval(refreshTrace, TRACE_RELOAD_MILLIS);
}

export default useExtensionTrace;
