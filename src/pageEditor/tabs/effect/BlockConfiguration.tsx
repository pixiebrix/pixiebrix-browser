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

import React, { useMemo, useRef } from "react";
import { type RegistryId } from "@/types/registryTypes";
import { getIn, useField, useFormikContext } from "formik";
import useBrickOptions from "@/hooks/useBrickOptions";
import SchemaFieldContext from "@/components/fields/schemaFields/SchemaFieldContext";
import devtoolFieldOverrides from "@/pageEditor/fields/devtoolFieldOverrides";
import Loader from "@/components/Loader";
import ConnectedFieldTemplate from "@/components/form/ConnectedFieldTemplate";
import { useAsyncState } from "@/hooks/common";
import SelectWidget from "@/components/form/widgets/SelectWidget";
import { partial } from "lodash";
import { type BrickConfig } from "@/bricks/types";
import AdvancedLinks, {
  DEFAULT_WINDOW_VALUE,
} from "@/pageEditor/tabs/effect/AdvancedLinks";
import { type SchemaFieldProps } from "@/components/fields/schemaFields/propTypes";
import SchemaField from "@/components/fields/schemaFields/SchemaField";
import getType from "@/runtime/getType";
import { type ModComponentFormState } from "@/pageEditor/starterBricks/formStateTypes";
import ConnectedCollapsibleFieldSection from "@/pageEditor/fields/ConnectedCollapsibleFieldSection";
import { joinName } from "@/utils/formUtils";
import { inputProperties } from "@/utils/schemaUtils";
import {
  rootModeOptions,
  windowOptions,
} from "@/pageEditor/tabs/effect/configurationConstants";
import useAsyncEffect from "use-async-effect";

const BlockConfiguration: React.FunctionComponent<{
  name: string;
  blockId: RegistryId;
}> = ({ name, blockId }) => {
  const configName = partial(joinName, name);

  const context = useFormikContext<ModComponentFormState>();
  const [config] = useField<BrickConfig>(name);
  const [_rootField, _rootFieldMeta, rootFieldHelpers] = useField<BrickConfig>(
    configName("root")
  );
  const blockErrors = getIn(context.errors, name);

  const [{ block, error }, BlockOptions] = useBrickOptions(blockId);

  // Conditionally show Advanced options "Condition" and "Target" depending on the value of blockType.
  // If blockType is undefined, don't show the options.
  // If error happens, behavior is undefined.
  const [blockType] = useAsyncState(async () => getType(block), [block]);

  const [isRootAware] = useAsyncState(async () => {
    const inputSchema = inputProperties(block.inputSchema);
    // Handle DOM bricks that were upgraded to be root-aware
    if ("isRootAware" in inputSchema) {
      return Boolean(config.value.config.isRootAware);
    }

    return block.isRootAware();
  }, [block, config.value.config.isRootAware]);

  const advancedOptionsRef = useRef<HTMLDivElement>();

  useAsyncEffect(
    async () => {
      // Effect to clear out unused `root` field. Technically, `root` could contain a selector when used with `document`
      // or `inherit` mode, but we don't want to support that in the Page Editor because it's legacy behavior.
      if (config.value.rootMode !== "element") {
        await rootFieldHelpers.setValue(null);
      }
    }, // Dependencies - rootFieldHelpers changes reference every render
    [config.value.rootMode]
  );

  const rootElementSchema: SchemaFieldProps = useMemo(
    () => ({
      name: configName("root"),
      label: "Target Element",
      description: (
        <span>
          The target element for the brick. Provide element reference{" "}
          <code>@input.element.ref</code>, or a reference generated with the
          Element Reader, For-Each Element, or Traverse Elements brick
        </span>
      ),
      // If the field is visible, it's required
      isRequired: true,
      schema: {
        // The type is https://app.pixiebrix.com/schemas/element#, but schema field doesn't support that
        // XXX: this should really restrict to "variable" entry. Text values will also be interpreted properly, it's
        //  there's just no use-case for hard coded element uuids or text template expressions
        type: "string",
      },
    }),
    [configName]
  );

  const ifSchemaProps: SchemaFieldProps = useMemo(
    () => ({
      name: configName("if"),
      schema: {
        type: ["string", "number", "boolean"],
      },
      label: "Condition",
      description: (
        <p>
          Condition determining whether or not to execute the brick. Truthy
          string values are&nbsp;
          <code>true</code>, <code>t</code>, <code>yes</code>, <code>y</code>,{" "}
          <code>on</code>, and <code>1</code> (case-insensitive)
        </p>
      ),
    }),
    [configName]
  );

  // Only show if the extension point supports a target mode. menuItem implicitly supports target mode, because
  // it's root-aware if multiple menu items are added to the page.
  // Technically trigger/quickBar/etc. allow the user to pick the target mode. But for now, show the field even if
  // the user has configured the extension point to use the document as the target.
  // Include tour because the Show Tour Step brick passes the target through to its pipeline
  const showRootMode =
    isRootAware &&
    [
      "trigger",
      "contextMenu",
      "quickBar",
      "quickBarProvider",
      "menuItem",
      "tour",
    ].includes(context.values.type);
  const showIfAndTarget = blockType && blockType !== "renderer";
  const noAdvancedOptions = !showRootMode && !showIfAndTarget;

  return (
    <>
      <AdvancedLinks name={name} scrollToRef={advancedOptionsRef} />

      <>
        <SchemaFieldContext.Provider value={devtoolFieldOverrides}>
          {blockErrors?.id && (
            <div className="invalid-feedback d-block mb-4">
              Unknown block {blockId}
            </div>
          )}
          {BlockOptions ? (
            <BlockOptions name={name} configKey="config" />
          ) : error ? (
            <div className="invalid-feedback d-block mb-4">{error}</div>
          ) : (
            <Loader />
          )}
        </SchemaFieldContext.Provider>

        <ConnectedCollapsibleFieldSection
          title="Advanced Options"
          bodyRef={advancedOptionsRef}
        >
          {showIfAndTarget && <SchemaField {...ifSchemaProps} omitIfEmpty />}

          {showRootMode && (
            <ConnectedFieldTemplate
              name={configName("rootMode")}
              label="Target Root Mode"
              as={SelectWidget}
              options={rootModeOptions}
              blankValue="inherit"
              description="The Root Mode controls the page element the brick targets. PixieBrix evaluates selectors relative to the root document/element"
            />
          )}

          {config.value.rootMode === "element" && (
            <SchemaField {...rootElementSchema} omitIfEmpty />
          )}

          {showIfAndTarget && (
            <ConnectedFieldTemplate
              name={configName("window")}
              label="Target Tab/Frame"
              as={SelectWidget}
              options={windowOptions}
              blankValue={DEFAULT_WINDOW_VALUE}
              description="The tab/frame to run the brick. To ensure PixieBrix has permission to run on the tab, add an Extra Permissions pattern that matches the target tab URL"
            />
          )}

          {noAdvancedOptions && (
            <small className="text-muted font-italic">No options to show</small>
          )}
        </ConnectedCollapsibleFieldSection>
      </>
    </>
  );
};

export default BlockConfiguration;
