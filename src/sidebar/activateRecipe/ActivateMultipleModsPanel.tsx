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

import React, { useMemo } from "react";
import { type RegistryId } from "@/types/registryTypes";
import RequireMods, {
  type RequiredModDefinition,
} from "@/sidebar/activateRecipe/RequireMods";
import AsyncStateGate from "@/components/AsyncStateGate";
import { getOptionsValidationSchema } from "@/hooks/useAsyncRecipeOptionsValidationSchema";
import useDatabaseOptions from "@/hooks/useDatabaseOptions";
import { useDispatch, useSelector } from "react-redux";
import { selectExtensions } from "@/store/extensionsSelectors";
import useDeriveAsyncState from "@/hooks/useDeriveAsyncState";
import { type Option } from "@/components/form/widgets/SelectWidget";
import { wizardStateFactory } from "@/activation/useActivateRecipeWizard";
import useActivateRecipe, {
  type ActivateResult,
} from "@/activation/useActivateRecipe";
import { SuccessPanel } from "@/sidebar/activateRecipe/ActivateModPanel";
import { getTopLevelFrame } from "webext-messenger";
import { hideSidebar } from "@/contentScript/messenger/api";
import sidebarSlice from "@/sidebar/sidebarSlice";
import { selectSidebarHasModPanels } from "@/sidebar/sidebarSelectors";

type ModResultPair = {
  mod: RequiredModDefinition;
  result: ActivateResult;
};

const MultipleSuccessPanel: React.FC<{ results: ModResultPair[] }> = ({
  results,
}) => {
  const reduxDispatch = useDispatch();
  const sidebarHasModPanels = useSelector(selectSidebarHasModPanels);

  async function handleActivationDecision() {
    reduxDispatch(sidebarSlice.actions.hideModActivationPanel());

    if (!sidebarHasModPanels) {
      const topFrame = await getTopLevelFrame();
      void hideSidebar(topFrame);
    }
  }

  return (
    <SuccessPanel
      title="Your mods are ready to use!"
      numMods={results.length}
      includesQuickBar={results.some((x) => x.mod.includesQuickBar)}
      handleActivationDecision={handleActivationDecision}
    />
  );
};

/**
 * React Component Panel to automatically activate multiple mods and show a success message.
 * @param mods mod definitions supporting automatic activation
 */
const AutoActivatePanel: React.FC<{ mods: RequiredModDefinition[] }> = ({
  mods,
}) => {
  // Assume mods work without all permissions. Currently, the only optional permission is `clipboardWrite`, which isn't
  // actually enforced by Chrome. (Mods can still copy to the clipboard.). The only way a mod would not have all
  // permissions is if their Enterprise policy has disabled some permissions.
  const activate = useActivateRecipe("marketplace", {
    checkPermissions: false,
  });

  // Only activate new mods that the user does not already have activated. If there are updates available, the
  // user will be prompted to update according to marketplace mod updater rules.
  const newMods = useMemo(() => mods.filter((x) => !x.isActive), [mods]);
  const activatedModComponents = useSelector(selectExtensions);
  const databaseOptionsState = useDatabaseOptions({ refetchOnMount: true });

  // A bit hacky -- using useDeriveAsyncState to automatically activate the mods on mount
  const activationResultState = useDeriveAsyncState(
    databaseOptionsState,
    async (databaseOptions: Option[]) => {
      if (newMods.some((x) => x.requiresConfiguration)) {
        throw new Error(
          "One or more mods require configuration. Activate the mods individually to configure them."
        );
      }

      return Promise.all(
        newMods.map(async (mod) => {
          const optionsValidationSchema = await getOptionsValidationSchema(
            mod.modDefinition.options?.schema
          );

          const wizard = wizardStateFactory({
            modDefinition: mod.modDefinition,
            defaultAuthOptions: mod.defaultAuthOptions,
            databaseOptions,
            optionsValidationSchema,
            installedExtensions: activatedModComponents,
          });

          const result = await activate(
            wizard.initialValues,
            mod.modDefinition
          );

          if (result.error) {
            throw new Error(
              `Error activating ${mod.modDefinition.metadata.name}`,
              { cause: new Error(result.error) }
            );
          }

          return {
            result,
            mod,
          };
        })
      );
    }
  );

  return (
    <AsyncStateGate state={activationResultState}>
      {({ data: results }) => <MultipleSuccessPanel results={results} />}
    </AsyncStateGate>
  );
};

/**
 * React Component Panel to automatically activate multiple mods and show a success message.
 * @param modId the mod id
 *
 * @since 1.7.35
 */
const ActivateMultipleModsPanel: React.FC<{ modIds: RegistryId[] }> = ({
  modIds,
}) => (
  <RequireMods modIds={modIds}>
    {(mods) => <AutoActivatePanel mods={mods} />}
  </RequireMods>
);

export default ActivateMultipleModsPanel;
