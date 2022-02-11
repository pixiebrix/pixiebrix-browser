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

import React, { createContext, useEffect, useState } from "react";
import { clearLog, LogEntry } from "@/background/logging";
import usePollContextLogs from "./usePollContextLogs";
import { MessageContext } from "@/core";

type LogState = {
  messageContext: MessageContext;
  allEntries: LogEntry[];
  displayedEntries: LogEntry[];
  isLoading: boolean;
  refresh: () => void;
  clear: () => Promise<void>;
};

const defaultState: LogState = {
  messageContext: null,
  allEntries: [],
  displayedEntries: [],
  isLoading: true,
  refresh: () => {},
  clear: async () => {},
};

export const LogContext2 = createContext<LogState>(defaultState);

type ContextLogsProps = {
  messageContext: MessageContext;
};

/**
 * Fetches the logs from storage and tracks the displayed entries.
 */
export const ContextLogs: React.FunctionComponent<ContextLogsProps> = ({
  messageContext,
  children,
}) => {
  const [displayedEntries, setDisplayedEntries] = useState<LogEntry[]>([]);
  const { entries: allEntries, isLoading } = usePollContextLogs({
    context: messageContext,
  });

  // Initialize displayed entries when the loading state changes
  useEffect(() => {
    console.log("ContextLogs", "init effect", { allEntries, isLoading });
    setDisplayedEntries(allEntries);
  }, [isLoading]);

  const refresh = () => {
    setDisplayedEntries(allEntries);
  };

  const clear = async () => clearLog(messageContext);

  return (
    <LogContext2.Provider
      value={{
        messageContext,
        allEntries,
        displayedEntries,
        isLoading,
        refresh,
        clear,
      }}
    >
      {children}
    </LogContext2.Provider>
  );
};
