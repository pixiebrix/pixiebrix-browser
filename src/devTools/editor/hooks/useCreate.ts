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

import { editorSlice, FormState } from "@/devTools/editor/editorSlice";
import { useDispatch } from "react-redux";
import { useCallback, useState } from "react";
import { AxiosError } from "axios";
import { optionsSlice } from "@/options/slices";
import { FormikHelpers } from "formik";
import { uniq } from "lodash";
import { AddToast, useToasts } from "react-toast-notifications";
import { reportError } from "@/telemetry/logging";
import blockRegistry from "@/blocks/registry";
import extensionPointRegistry from "@/extensionPoints/registry";
import { makeExtensionReaders } from "@/devTools/editor/extensionPoints/base";
import { ADAPTERS } from "@/devTools/editor/extensionPoints/adapter";
import { reactivate } from "@/background/navigation";
import { reportEvent } from "@/telemetry/events";
import { fromJS as extensionPointFactory } from "@/extensionPoints/factory";
import { extensionPermissions } from "@/permissions";
import { isCustomReader } from "@/devTools/editor/extensionPoints/elementConfig";
import { requestPermissions } from "@/utils/permissions";
import { getErrorMessage } from "@/errors";
import { getLinkedApiClient } from "@/services/apiClient";
import { objToYaml } from "@/utils/objToYaml";

const { saveExtension } = optionsSlice.actions;
const { markSaved } = editorSlice.actions;

export interface EditablePackage {
  id: string;
  name: string;
}

async function upsertConfig(
  packageUUID: string | null,
  kind: "reader" | "extensionPoint",
  config: unknown
): Promise<void> {
  const client = await getLinkedApiClient();

  const data = { config: objToYaml(config as Record<string, unknown>), kind };

  if (packageUUID) {
    await client.put(`api/bricks/${packageUUID}/`, data);
    return;
  }

  await client.post("api/bricks/", data);
}

function selectErrorMessage(error: unknown): string {
  // FIXME: should this logic be in getErrorMessage?
  if (typeof error === "object" && (error as AxiosError).isAxiosError) {
    const error_ = error as AxiosError;
    return (
      error_.response?.data.config?.toString() ??
      error_.response?.statusText ??
      "No response from PixieBrix server"
    );
  }

  return getErrorMessage(error);
}

async function ensurePermissions(element: FormState, addToast: AddToast) {
  const adapter = ADAPTERS.get(element.type);

  const {
    extension,
    extensionPoint: extensionPointConfig,
  } = adapter.asDynamicElement(element);

  const extensionPoint = extensionPointFactory(extensionPointConfig);

  // Pass the extensionPoint in directly because the foundation will not have been saved/added to the
  // registry at this point when called from useCreate
  const permissions = await extensionPermissions(extension, {
    extensionPoint,
  });

  console.debug("Ensuring permissions", {
    permissions,
    extensionPointConfig,
    extension,
  });

  const hasPermissions = await requestPermissions(permissions);

  if (!hasPermissions) {
    addToast(
      "You declined the additional required permissions. This brick won't work on other tabs until you grant the permissions",
      {
        appearance: "warning",
        autoDismiss: true,
      }
    );
  }
}

type CreateCallback = (
  element: FormState,
  helpers: FormikHelpers<FormState>
) => Promise<void>;

export function useCreate(): CreateCallback {
  // XXX: Some users have problems when saving from the Page Editor that seem to indicate the sequence of events doesn't
  //  occur in the correct order on slower (CPU or network?) machines. Therefore, await all promises. We also have to
  //  make `reactivate` behave deterministically if we're still having problems (right now it's implemented as a
  //  fire-and-forget notification).

  const dispatch = useDispatch();
  const { addToast } = useToasts();
  // Which reader ids have been saved in this session. If a reader has been saved,
  const [savedReaders, setSavedReaders] = useState<string[]>([]);

  return useCallback(
    async (
      element: FormState,
      { setSubmitting, setStatus }: FormikHelpers<FormState>
    ) => {
      const onStepError = (error: unknown, step: string) => {
        const message = selectErrorMessage(error);
        reportError(error);
        console.warn(`Error %s: %s`, step, message, { error });
        setStatus(`Error ${step}: ${message}`);
        addToast(`Error ${step}: ${message}`, {
          appearance: "error",
          autoDismiss: true,
        });
        setSubmitting(false);
      };

      try {
        const adapter = ADAPTERS.get(element.type);

        try {
          await ensurePermissions(element, addToast);
        } catch (error: unknown) {
          // Continue to allow saving (because there's a workaround)
          reportError(error);
          console.error("Error checking/enabling permissions", { error });
          addToast(
            "An error occurred checking/enabling permissions. Grant permissions on the Active Bricks page",
            {
              appearance: "warning",
              autoDismiss: true,
            }
          );
        }

        // PERFORMANCE: inefficient, grabbing all visible bricks prior to save. Not a big deal for now given
        // number of bricks implemented and frequency of saves
        const { data: editablePackages } = await (
          await getLinkedApiClient()
        ).get<EditablePackage[]>("api/bricks/");

        const isEditable = editablePackages.some(
          (x) => x.name === element.extensionPoint.metadata.id
        );
        const isLocked = element.installed && !isEditable;

        if (!isLocked) {
          try {
            // Save custom readers first because the extension point definition will reference them
            const customReaders = makeExtensionReaders(
              element
            ).filter((reader) => isCustomReader(reader));
            for (const customReader of customReaders) {
              // SavedReaders is to handle case where save failed for the foundation, so subsequent saves needs
              // to update the reader
              const packageId =
                element.installed ||
                savedReaders.includes(customReader.metadata.id)
                  ? editablePackages.find(
                      // Bricks endpoint uses "name" instead of id
                      (x) => x.name === customReader.metadata.id
                    )?.id
                  : null;

              await upsertConfig(packageId, "reader", customReader);

              setSavedReaders((prev) =>
                uniq([...prev, customReader.metadata.id])
              );
            }
          } catch (error: unknown) {
            onStepError(error, "saving reader definition");
            return;
          }

          try {
            const extensionPointConfig = adapter.selectExtensionPoint(element);
            const packageId = element.installed
              ? editablePackages.find(
                  // Bricks endpoint uses "name" instead of id
                  (x) => x.name === extensionPointConfig.metadata.id
                )?.id
              : null;

            await upsertConfig(
              packageId,
              "extensionPoint",
              extensionPointConfig
            );
          } catch (error: unknown) {
            onStepError(error, "saving foundation");
            return;
          }
        }

        reportEvent("PageEditorCreate", {
          type: element.type,
        });

        try {
          // Make sure the pages have the latest blocks/etc (e.g., the saved reader). for when we reactivate below
          await Promise.all([
            blockRegistry.fetch(),
            extensionPointRegistry.fetch(),
          ]);
        } catch (error: unknown) {
          reportError(error);
          addToast(
            `Error fetching remote bricks: ${selectErrorMessage(error)}`,
            {
              appearance: "warning",
              autoDismiss: true,
            }
          );
        }

        try {
          dispatch(saveExtension(adapter.selectExtension(element)));
          dispatch(markSaved(element.uuid));
        } catch (error: unknown) {
          onStepError(error, "saving extension");
          return;
        }

        try {
          await reactivate();
        } catch (error: unknown) {
          reportError(error);
          addToast(
            `Error re-activating bricks on page(s): ${selectErrorMessage(
              error
            )}`,
            {
              appearance: "warning",
              autoDismiss: true,
            }
          );
        }

        addToast("Saved extension", {
          appearance: "success",
          autoDismiss: true,
        });
      } catch (error: unknown) {
        console.error("Error saving extension", { error });
        reportError(error);
        addToast(`Error saving extension: ${getErrorMessage(error)}`, {
          appearance: "error",
          autoDismiss: true,
        });
      } finally {
        setSubmitting(false);
      }
    },
    [dispatch, addToast, setSavedReaders, savedReaders]
  );
}
