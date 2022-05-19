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

import { selectScope } from "@/auth/authSelectors";
import { RegistryId, UnresolvedExtension, UUID } from "@/core";
import { selectExtensions } from "@/store/extensionsSelectors";
import { generateRecipeId } from "@/utils/recipeUtils";
import { FormikWizard, Step } from "formik-wizard-form";
import React, { useCallback, useMemo } from "react";
import { Button, Modal } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { selectShowShareContext } from "./blueprintModalsSelectors";
import { blueprintModalsSlice } from "./blueprintModalsSlice";
import * as Yup from "yup";
import { PACKAGE_REGEX, validateSemVerString } from "@/types/helpers";
import { isEmpty, pick } from "lodash";
import { OnSubmit } from "@/components/form/Form";
import { isAxiosError } from "@/errors";
import { appApi } from "@/services/api";
import {
  RecipeDefinition,
  selectSourceRecipeMetadata,
} from "@/types/definitions";
import { FormikHelpers } from "formik";
import { getLinkedApiClient } from "@/services/apiClient";
import { PackageUpsertResponse } from "@/types/contract";
import { objToYaml } from "@/utils/objToYaml";
import { makeBlueprint } from "../utils/exportBlueprint";
import extensionsSlice from "@/store/extensionsSlice";
import notify from "@/utils/notify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import ConnectedFieldTemplate from "@/components/form/ConnectedFieldTemplate";
import RegistryIdWidget from "@/components/form/widgets/RegistryIdWidget";
import { StylesConfig } from "react-select";
import { FieldDescriptions } from "@/utils/strings";

// TODO:
// 1. add status line

type ShareInstallableFormState = {
  blueprintId: RegistryId;
  name: string;
  description: string;
  public: boolean;
  organizations: UUID[];
};

const selectStylesOverride: StylesConfig = {
  control: (base) => ({
    ...base,
    borderRadius: 0,
    border: "none",
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "0.875rem 1.375rem",
  }),
  singleValue: (base) => ({
    ...base,
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
  }),
  input: (base) => ({
    ...base,
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
  }),
};

const stepConvertToRecipe = {
  component: () => (
    <>
      <div className="text-info">
        <FontAwesomeIcon icon={faInfoCircle} /> To share, first give your
        blueprint a name.
      </div>
      <div>
        <ConnectedFieldTemplate
          name="name"
          label="Name"
          description={FieldDescriptions.BLUEPRINT_NAME}
        />
        <ConnectedFieldTemplate
          name="blueprintId"
          label="Blueprint Id"
          description={
            <span>
              {FieldDescriptions.BLUEPRINT_ID}.{" "}
              <i>Cannot be modified once shared.</i>
            </span>
          }
          as={RegistryIdWidget}
          selectStyles={selectStylesOverride}
        />
        <ConnectedFieldTemplate
          name="description"
          label="Description"
          description={FieldDescriptions.BLUEPRINT_DESCRIPTION}
        />
      </div>
    </>
  ),
  validationSchema: Yup.object().shape({
    blueprintId: Yup.string()
      .matches(PACKAGE_REGEX, "Invalid registry id")
      .required(),
    name: Yup.string().required(),
    description: Yup.string().required(),
  }),
};
const stepShare = {
  component: () => <div>Second step</div>,
  validationSchema: Yup.object().shape({
    public: Yup.boolean().required(),
    organizations: Yup.array().of(Yup.string().required()),
  }),
};

async function convertAndShare(
  extension: UnresolvedExtension,
  form: ShareInstallableFormState
): Promise<RecipeDefinition> {
  const client = await getLinkedApiClient();

  const blueprint = makeBlueprint(extension, {
    id: form.blueprintId,
    name: form.name,
    description: form.description,
    version: validateSemVerString("1.0.0"),
  });

  const { data } = await client.post<PackageUpsertResponse>("api/bricks/", {
    config: objToYaml(blueprint),
    kind: "recipe",
    public: form.public,
    organizations: form.organizations,
    share_dependencies: true,
  });

  return {
    ...blueprint,
    sharing: pick(data, ["public", "organizations"]),
    ...pick(data, ["updated_at"]),
  };
}

const ShareInstallableModal: React.FunctionComponent = () => {
  const dispatch = useDispatch();

  const { extensionId, blueprintId } = useSelector(selectShowShareContext);

  const extensions = useSelector(selectExtensions);

  const extension = useMemo(() => {
    if (extensionId == null) {
      return null;
    }

    const extension = extensions.find((x) => x.id === extensionId);
    if (extension == null) {
      throw new Error(`No persisted extension exists with id: ${extensionId}`);
    }

    return extension;
  }, [extensions, extensionId]);

  const scope = useSelector(selectScope);

  const initialValues: ShareInstallableFormState = {
    blueprintId: generateRecipeId(scope, extension.label),
    name: extension.label,
    description: "Created with the PixieBrix Page Editor",
    organizations: [],
    public: false,
  };

  const onCancel = () => {
    dispatch(blueprintModalsSlice.actions.setShareContext(null));
  };

  const onShare: OnSubmit = useCallback(
    async (
      values: ShareInstallableFormState,
      helpers: FormikHelpers<ShareInstallableFormState>
    ) => {
      try {
        const recipe: RecipeDefinition = await convertAndShare(
          extension,
          values
        );
        dispatch(
          extensionsSlice.actions.attachExtension({
            extensionId: extension.id,
            recipeMetadata: selectSourceRecipeMetadata(recipe),
          })
        );
        notify.success("Converted/shared brick");

        // Hide the share modal and show the share link modal
        dispatch(
          blueprintModalsSlice.actions.setShareContext({
            blueprintId: recipe.metadata.id,
          })
        );

        dispatch(appApi.util.invalidateTags(["Recipes"]));
      } catch (error) {
        if (isAxiosError(error) && error.response.data.config) {
          helpers.setStatus(error.response.data.config);
          return;
        }

        notify.error({
          message: "Error converting/sharing brick",
          error,
        });
      } finally {
        helpers.setSubmitting(false);
      }
    },
    [dispatch, extension]
  );

  const steps: Step[] = [stepShare];
  if (blueprintId == null) {
    steps.unshift(stepConvertToRecipe);
  }

  return (
    <FormikWizard
      initialValues={initialValues}
      onSubmit={onShare}
      validateOnNext
      activeStepIndex={0}
      steps={steps}
    >
      {({
        renderComponent,
        handleNext,
        isNextDisabled,
        isLastStep,
        values,
      }) => (
        <Modal show onHide={onCancel}>
          <Modal.Header>
            <Modal.Title>Share as Blueprint</Modal.Title>
          </Modal.Header>
          <Modal.Body>{renderComponent()}</Modal.Body>
          <Modal.Footer>
            <Button variant="link" onClick={onCancel}>
              Cancel
            </Button>
            <Button disabled={isNextDisabled} onClick={handleNext}>
              {isLastStep
                ? values.public || !isEmpty(values.organizations)
                  ? "Share"
                  : "Convert"
                : "Next"}
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </FormikWizard>
  );
};

export default ShareInstallableModal;
