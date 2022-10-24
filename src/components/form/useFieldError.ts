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

import { useSelector } from "react-redux";
import { selectAnnotationsForPath } from "@/pageEditor/slices/editorSelectors";
import { useField } from "formik";

function useFormikFieldError(
  fieldPath: string,
  showUntouched?: boolean
): string | undefined {
  const [, { error, touched }] = useField(fieldPath);

  if (showUntouched) {
    return error;
  }

  return touched ? error : null;
}

function useAnalysisFieldError(fieldPath: string): string[] | undefined {
  const annotations = useSelector(selectAnnotationsForPath(fieldPath));

  return annotations?.length > 0
    ? annotations.map(({ message }) => message)
    : undefined;
}

let shouldUseAnalysis = false;
function useFieldError(
  fieldPath: string,
  options?: {
    forceFormik?: boolean;
    showUntouchedErrors?: boolean;
  }
): string | string[] | undefined {
  return shouldUseAnalysis && !options?.forceFormik
    ? // eslint-disable-next-line react-hooks/rules-of-hooks -- shouldUseAnalysis is set once before render
      useAnalysisFieldError(fieldPath)
    : // eslint-disable-next-line react-hooks/rules-of-hooks -- shouldUseAnalysis is set once before render
      useFormikFieldError(fieldPath, options?.showUntouchedErrors);
}

/**
 * Configure the form field to use the analysis annotations
 * instead of the formik to get the errors.
 * Should be called once only at the start of the application.
 */
export function enableAnalysisFieldErrors() {
  shouldUseAnalysis = true;
}

export default useFieldError;
