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

import React, { useMemo, useState } from "react";
import { LogEntry } from "@/background/logging";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretDown, faCaretRight } from "@fortawesome/free-solid-svg-icons";
import { ErrorObject } from "serialize-error";
import { ContextError } from "@/errors";
import { isErrorObject } from "@/utils";
import { InputValidationError } from "@/blocks/errors";
import { AxiosError } from "axios";
import InputDetail from "@/components/logViewer/details/InputDetail";
import InputValidationErrorDetail from "@/components/logViewer/details/InputValidationErrorDetail";
import NetworkErrorDetail from "@/components/logViewer/details/NetworkErrorDetail";
import OutputDetail from "@/components/logViewer/details/OutputDetail";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "short",
  timeStyle: "short",
});

function getRootCause(error: ErrorObject): ErrorObject {
  if (error.name === "ContextError" && (error as ContextError).cause != null) {
    return getRootCause(error.cause as ErrorObject);
  }
  return error;
}

const ErrorDetail: React.FunctionComponent<{ entry: LogEntry }> = ({
  entry,
}) => {
  const detail = useMemo(() => {
    if (isErrorObject(entry.error)) {
      const rootCause = getRootCause(entry.error);
      if (rootCause.name === "InputValidationError") {
        return (
          <InputValidationErrorDetail
            error={(rootCause as unknown) as InputValidationError}
          />
        );
      } else if (rootCause.isAxiosError) {
        return (
          <NetworkErrorDetail error={(rootCause as unknown) as AxiosError} />
        );
      }
      return entry.error.stack;
    }
    return entry.error.toString();
  }, [entry.error]);

  return <div style={{ whiteSpace: "pre-wrap" }}>{detail}</div>;
};

const EntryRow: React.FunctionComponent<{ entry: LogEntry }> = ({ entry }) => {
  const [expanded, setExpanded] = useState(false);

  const Detail = useMemo(() => {
    if (typeof entry.error === "object" && entry.error) {
      return ErrorDetail;
    } else if (entry.data?.renderedArgs != null) {
      return InputDetail;
    } else if (entry.data?.output != null) {
      return OutputDetail;
    } else {
      return null;
    }
  }, [entry]);

  const expandable = !!Detail;

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: expandable ? "pointer" : "" }}
      >
        <td>
          {expandable && (
            <span>
              <FontAwesomeIcon icon={expanded ? faCaretDown : faCaretRight} />
            </span>
          )}
        </td>
        <td>{dateFormat.format(new Date(Number(entry.timestamp)))}</td>
        <td>{entry.level.toUpperCase()}</td>
        <td>{entry.context?.blockId ?? entry.context?.serviceId ?? ""}</td>
        <td>{entry.message}</td>
      </tr>
      {expanded && expandable && (
        <tr>
          <td>&nbsp;</td>
          <td colSpan={4}>
            <Detail entry={entry} />
          </td>
        </tr>
      )}
    </>
  );
};

export default EntryRow;
