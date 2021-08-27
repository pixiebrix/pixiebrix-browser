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

import React from "react";
import { FormState } from "@/devTools/editor/editorSlice";
import { Tab } from "react-bootstrap";
import RunLogCard from "./RunLogCard";
import { useFormikContext } from "formik";

export const LOGS_EVENT_KEY = "logs";

const LogsTab: React.FunctionComponent<{
  eventKey: string;
}> = ({ eventKey = LOGS_EVENT_KEY }) => {
  const { values } = useFormikContext<FormState>();

  return (
    <Tab.Pane eventKey={eventKey} className="h-100">
      <RunLogCard
        extensionPointId={values.extensionPoint.metadata.id}
        extensionId={values.uuid}
        initialLevel="debug"
        refreshInterval={750}
      />
    </Tab.Pane>
  );
};

export default LogsTab;
