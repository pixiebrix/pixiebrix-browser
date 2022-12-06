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

import { LOG_LEVELS, type MessageLevel } from "@/telemetry/logging";
import { useMemo } from "react";
import { selectLogs } from "@/components/logViewer/logSelectors";
import { useSelector } from "react-redux";

type Config = {
  level: MessageLevel;
  page: number;
  perPage: number;
};

function useLogEntriesView({ level, page, perPage }: Config) {
  const { availableEntries, entries } = useSelector(selectLogs);

  const filteredAvailableEntries = useMemo(
    () =>
      availableEntries.filter(
        // eslint-disable-next-line security/detect-object-injection -- level is coming from the dropdown
        (entry) => LOG_LEVELS[entry.level] >= LOG_LEVELS[level]
      ),
    [level, availableEntries]
  );

  const filteredEntries = useMemo(
    () =>
      (entries ?? []).filter(
        // eslint-disable-next-line security/detect-object-injection -- level is coming from the dropdown
        (entry) => LOG_LEVELS[entry.level] >= LOG_LEVELS[level]
      ),
    [level, entries]
  );

  const numNew = filteredAvailableEntries.length - filteredEntries.length;

  const hasEntries = availableEntries.length > 0;

  const start = page * perPage;
  const pageEntries = filteredEntries.slice(start, start + perPage);

  const numPages = Math.ceil(filteredEntries.length / perPage);

  return {
    numNew,
    hasEntries,
    pageEntries,
    numPages,
  };
}

export default useLogEntriesView;
