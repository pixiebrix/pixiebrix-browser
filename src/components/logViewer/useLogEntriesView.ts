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

import { LOG_LEVELS, MessageLevel } from "@/background/logging";
import { useContext, useMemo } from "react";
import { LogContext } from "./Logs";

type config = {
  level: MessageLevel;
  page: number;
  perPage: number;
};

function useLogEntriesView({ level, page, perPage }: config) {
  const { allEntries, displayedEntries } = useContext(LogContext);

  const filteredAllEntries = useMemo(() => {
    console.log("useLogEntries2", "filteredAllEntries");
    return allEntries.filter(
      // eslint-disable-next-line security/detect-object-injection -- level is coming from the dropdown
      (entry) => LOG_LEVELS[entry.level] >= LOG_LEVELS[level]
    );
  }, [level, allEntries]);

  const filteredDisplayedEntries = useMemo(() => {
    console.log("useLogEntries2", "filteredEntries");
    return (displayedEntries ?? []).filter(
      // eslint-disable-next-line security/detect-object-injection -- level is coming from the dropdown
      (entry) => LOG_LEVELS[entry.level] >= LOG_LEVELS[level]
    );
  }, [level, displayedEntries]);

  const numNew = filteredAllEntries.length - filteredDisplayedEntries.length;

  const hasEntries = allEntries.length > 0;

  const start = page * perPage;
  const pageEntries = filteredDisplayedEntries.slice(start, start + perPage);

  const numPages = Math.ceil(filteredDisplayedEntries.length / perPage);

  return {
    numNew,
    hasEntries,
    pageEntries,
    numPages,
  };
}

export default useLogEntriesView;
