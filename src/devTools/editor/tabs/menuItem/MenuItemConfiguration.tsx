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
import ConnectedFieldTemplate from "@/components/form/ConnectedFieldTemplate";
import { Card } from "react-bootstrap";
import TemplateWidget, {
  Snippet,
} from "@/devTools/editor/fields/TemplateWidget";
import FieldSection from "@/devTools/editor/fields/FieldSection";
import UrlMatchPatternField from "@/devTools/editor/fields/UrlMatchPatternField";
import IconWidget from "@/components/fields/IconWidget";
import LocationWidget from "@/devTools/editor/fields/LocationWidget";
import SelectWidget, { Option } from "@/components/form/widgets/SelectWidget";

const menuSnippets: Snippet[] = [
  { label: "caption", value: "{{{caption}}}" },
  { label: "icon", value: "{{{icon}}}" },
  { label: "space", value: "&nbsp;" },
];

const positionOptions: Option[] = [
  { value: "append", label: "End" },
  { value: "prepend", label: "Start" },
];

const MenuItemConfiguration: React.FC<{
  isLocked: boolean;
}> = ({ isLocked = false }) => (
  <Card>
    <FieldSection title="Configuration">
      <ConnectedFieldTemplate
        name="extension.caption"
        label="Caption"
        description="Button caption"
      />

      <ConnectedFieldTemplate
        name="extensionPoint.definition.containerSelector"
        label="Location"
        as={LocationWidget}
        description="Location on the page"
      />

      <UrlMatchPatternField
        name="extensionPoint.definition.isAvailable.matchPatterns"
        label="Sites"
        disabled={isLocked}
      />
    </FieldSection>

    <FieldSection title="Advanced">
      <ConnectedFieldTemplate
        name="extension.icon"
        label="Icon"
        as={IconWidget}
        description="Icon to place in the icon placeholder of the template"
      />

      <ConnectedFieldTemplate
        name="extensionPoint.definition.position"
        label="Order/Position"
        description="Position relative to other menu items/buttons"
        as={SelectWidget}
        options={positionOptions}
      />

      <ConnectedFieldTemplate
        name="extensionPoint.definition.template"
        label="Template"
        as={TemplateWidget}
        description="A template for the item, with a placeholder for the caption and/or icon"
        snippets={menuSnippets}
      />
    </FieldSection>
  </Card>
);

export default MenuItemConfiguration;
