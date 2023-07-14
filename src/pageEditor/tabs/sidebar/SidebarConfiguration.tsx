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

import React from "react";
import ConnectedFieldTemplate from "@/components/form/ConnectedFieldTemplate";
import UrlMatchPatternField from "@/pageEditor/fields/UrlMatchPatternField";
import { makeLockableFieldProps } from "@/pageEditor/fields/makeLockableFieldProps";
import MatchRulesSection from "@/pageEditor/tabs/MatchRulesSection";
import { partial } from "lodash";
import { joinName } from "@/utils";
import DebounceFieldSet from "@/pageEditor/tabs/trigger/DebounceFieldSet";
import { type Trigger } from "@/starterBricks/sidebarExtension";
import { useField, useFormikContext } from "formik";
import { type TriggerFormState } from "@/pageEditor/starterBricks/formStateTypes";
import { type DebounceOptions } from "@/starterBricks/types";
import ExtraPermissionsSection from "@/pageEditor/tabs/ExtraPermissionsSection";

const SidebarConfiguration: React.FC<{
  isLocked: boolean;
}> = ({ isLocked = false }) => {
  const fieldName = partial(joinName, "extensionPoint.definition");

  const [{ value: trigger }] = useField<Trigger>(fieldName("trigger"));

  const [{ value: debounce }] = useField<DebounceOptions | null>(
    fieldName("debounce")
  );

  const { setFieldValue } = useFormikContext<TriggerFormState>();

  const onTriggerChange = ({
    currentTarget,
  }: React.FormEvent<HTMLSelectElement>) => {
    const nextTrigger = currentTarget.value as Trigger;

    if (nextTrigger === "custom") {
      void setFieldValue(fieldName("customEvent"), { eventName: "" });
    } else {
      void setFieldValue(fieldName("customEvent"), null);
    }

    if (nextTrigger !== "manual" && debounce == null) {
      // Add debounce by default, because the selection event fires for every event when clicking and dragging
      void setFieldValue(fieldName("debounce"), {
        waitMillis: 250,
        leading: false,
        trailing: true,
      });
    } else if (nextTrigger === "manual") {
      void setFieldValue(fieldName("debounce"), null);
    }

    void setFieldValue(fieldName("trigger"), currentTarget.value);
  };

  return (
    <>
      <ConnectedFieldTemplate
        name="extension.heading"
        label="Tab title"
        description="The text that will appear in the tab along the top of the Sidebar Panel"
      />

      <UrlMatchPatternField
        name="extensionPoint.definition.isAvailable.matchPatterns"
        {...makeLockableFieldProps("Sites", isLocked)}
      />

      <ConnectedFieldTemplate
        name={fieldName("trigger")}
        as="select"
        description="Event to refresh the panel"
        onChange={onTriggerChange}
        {...makeLockableFieldProps("Trigger", isLocked)}
      >
        <option value="load">Page Load / Navigation</option>
        <option value="selectionchange">Selection Change</option>
        <option value="statechange">State Change</option>
        <option value="custom">Custom Event</option>
        <option value="manual">Manual</option>
      </ConnectedFieldTemplate>

      {trigger === "custom" && (
        <ConnectedFieldTemplate
          title="Custom Event"
          name={fieldName("customEvent", "eventName")}
          description="The custom event name"
          {...makeLockableFieldProps("Custom Event", isLocked)}
        />
      )}

      <DebounceFieldSet isLocked={isLocked} />

      <MatchRulesSection isLocked={isLocked} />

      <ExtraPermissionsSection />
    </>
  );
};

export default SidebarConfiguration;
