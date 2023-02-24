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

// eslint-disable-next-line no-restricted-imports -- TODO: Fix over time
import { Form } from "react-bootstrap";
import type { MessageLevel } from "@/telemetry/logging";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSync, faTrash } from "@fortawesome/free-solid-svg-icons";
import React, { useCallback } from "react";
import notify from "@/utils/notify";
import AsyncButton from "@/components/AsyncButton";
import Pagination from "@/components/pagination/Pagination";

const LogToolbar: React.FunctionComponent<{
  level: MessageLevel;
  levelOptions?: MessageLevel[];
  setLevel: (level: MessageLevel) => void;
  page: number;
  setPage: (page: number) => void;
  numPages: number;
  hasEntries: boolean;
  numNew: number;
  clear: () => void;
  refresh: () => void;
}> = ({
  level,
  setLevel,
  setPage,
  page,
  numPages,
  hasEntries,
  numNew,
  clear,
  refresh,
  // Don't support "trace" by default
  levelOptions = ["debug", "info", "warn", "error"],
}) => {
  const onClear = () => {
    try {
      clear();
      notify.success("Cleared the log entries for this mod");
    } catch (error) {
      notify.error({
        message: "Error clearing log entries for mod",
        error,
      });
    }
  };

  const onRefresh = useCallback(() => {
    refresh();
    notify.success("Refreshed the log entries");
  }, [refresh]);

  return (
    <div className="px-3 pt-2">
      <div className="form-inline">
        <Form.Group>
          <Form.Label srOnly>Filter</Form.Label>
          <Form.Control
            size="sm"
            as="select"
            style={{ minWidth: 150 }}
            value={level}
            onChange={(x) => {
              setPage(0);
              setLevel(x.target.value as MessageLevel);
            }}
          >
            {levelOptions.map((level) => (
              <option key={level} value={level}>
                {level.toUpperCase()}
              </option>
            ))}
          </Form.Control>
        </Form.Group>
        <Form.Group className="ml-4">
          {numPages > 0 && (
            <Pagination page={page} numPages={numPages} setPage={setPage} />
          )}
        </Form.Group>
        <Form.Group className="ml-auto">
          {numNew > 0 && (
            <span className="text-info mr-2">
              {numNew} new {numNew > 1 ? "entries" : "entry"}
            </span>
          )}
          <AsyncButton size="sm" variant="info" onClick={onRefresh}>
            <FontAwesomeIcon icon={faSync} /> Refresh
          </AsyncButton>
          <AsyncButton
            size="sm"
            disabled={!hasEntries}
            variant="danger"
            onClick={onClear}
          >
            <FontAwesomeIcon icon={faTrash} /> Clear
          </AsyncButton>
        </Form.Group>
      </div>
    </div>
  );
};

export default LogToolbar;
