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

import { castArray, pick } from "lodash";
import { useCallback } from "react";
import { useHistory } from "react-router";
import { push } from "connected-react-router";
import { useDispatch } from "react-redux";
import { type EditorValues } from "./Editor";
import { type BrickValidationResult, validateSchema } from "./validate";
import useRefresh from "@/hooks/useRefresh";
import {
  type Definition,
  type UnsavedRecipeDefinition,
} from "@/types/definitions";
import useReinstall from "@/options/pages/blueprints/utils/useReinstall";
import notify from "@/utils/notify";
import { reportEvent } from "@/telemetry/events";
import {
  clearServiceCache,
  reactivateEveryTab,
} from "@/background/messenger/api";
import { loadBrickYaml } from "@/runtime/brickYaml";
import {
  useCreatePackageMutation,
  useUpdatePackageMutation,
  useDeletePackageMutation,
} from "@/services/api";
import { isSingleObjectBadRequestError } from "@/errors/networkErrorHelpers";
import { type UUID } from "@/core";

type SubmitOptions = {
  create: boolean;
};

type SubmitCallbacks = {
  validate: (values: EditorValues) => Promise<BrickValidationResult>;
  remove: (id: UUID) => Promise<void>;
  submit: (
    values: EditorValues,
    helpers: { setErrors: (errors: unknown) => void }
  ) => Promise<void>;
};

function useSubmitBrick({ create = false }: SubmitOptions): SubmitCallbacks {
  const [, refresh] = useRefresh({ refreshOnMount: false });
  const reinstall = useReinstall();
  const history = useHistory();
  const dispatch = useDispatch();

  const validate = useCallback(
    async (values: EditorValues) => validateSchema(values.config),
    []
  );

  const [createPackage] = useCreatePackageMutation();
  const [updatePackage] = useUpdatePackageMutation();
  const [deletePackage] = useDeletePackageMutation();

  const remove = useCallback(
    async (id: UUID) => {
      try {
        await deletePackage({ id }).unwrap();
      } catch (error) {
        notify.error({ message: "Error deleting brick", error });
        return;
      }

      notify.success("Deleted brick");
      reportEvent("BrickDelete");

      dispatch(push("/workshop"));
    },
    [dispatch, deletePackage]
  );

  const submit = useCallback(
    async (values, { setErrors, resetForm }) => {
      const { config, reactivate: reinstallBlueprint } = values;

      const unsavedBrickJson = loadBrickYaml(config) as
        | Definition
        | UnsavedRecipeDefinition;
      const { kind, metadata } = unsavedBrickJson;

      try {
        const data = await (create
          ? createPackage({ ...values, kind })
          : updatePackage({ ...values, kind })
        ).unwrap();

        // We attach the handler below, and don't want it to block the save
        void (async () => {
          try {
            if (kind === "recipe" && reinstallBlueprint) {
              // TypeScript doesn't have enough information to kind === "recipe" distinguishes RecipeDefinition from
              // Definition
              const unsavedRecipeDefinition =
                unsavedBrickJson as UnsavedRecipeDefinition;
              await reinstall({
                ...unsavedRecipeDefinition,
                sharing: pick(data, ["organizations", "public"]),
                ...pick(data, ["updated_at"]),
              });
            } else {
              await refresh();
            }

            if (kind === "service") {
              // Flear the background page's service cache after refreshing so
              // it's forced to read the updated service definition.
              await clearServiceCache();
            }

            reactivateEveryTab();
          } catch (error) {
            notify.warning({
              message: "Error re-activating bricks",
              error,
            });
          }
        })();

        notify.success(`${create ? "Created" : "Updated"} ${metadata.name}`);

        // Reset initial values of the form so dirty=false
        resetForm({ values });

        if (create) {
          history.push(`/workshop/bricks/${data.id}/`);
        }
      } catch (error) {
        console.debug("Got validation error", error);

        if (isSingleObjectBadRequestError(error)) {
          for (const message of castArray(error.response.data.__all__ ?? [])) {
            notify.error(message);
          }

          setErrors(error.response.data);
        } else {
          notify.error({ error });
        }
      }
    },
    [history, refresh, reinstall, create, createPackage, updatePackage]
  );

  return { submit, validate, remove: create ? null : remove };
}

export default useSubmitBrick;
