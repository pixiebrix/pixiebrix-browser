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

import React from "react";
import { Button } from "react-bootstrap";
import { getErrorMessage, isSpecificError } from "@/errors/errorHelpers";
import { useSelector } from "react-redux";
import { selectTabStateError } from "@/pageEditor/tabState/tabStateSelectors";
import { TimeoutError } from "@/utils";

/**
 * Error banner for Page Editor browser connection errors.
 *
 * Errors contacting the PixieBrix server are handled via `RequireAuth` and `ErrorBoundary`s
 *
 * @see RequireAuth
 */
const ErrorBanner: React.VFC = () => {
  const error = useSelector(selectTabStateError);

  if (!error) {
    return null;
  }

  const message = isSpecificError(error, TimeoutError)
    ? "The Page Editor could not establish a connection to the page"
    : getErrorMessage(error);

  return (
    <div className="d-flex p-2 align-items-center alert-danger flex-align-center">
      <div className="flex-grow-1">{message}</div>
      <div>
        <Button
          className="ml-2"
          onClick={() => {
            location.reload();
          }}
        >
          Reload Editor
        </Button>
      </div>
    </div>
  );
};

export default ErrorBanner;
