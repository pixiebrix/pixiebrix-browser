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
import { Button, Modal } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { selectShowPublishContext } from "@/extensionConsole/pages/mods/modals/modModalsSelectors";
import { modModalsSlice } from "@/extensionConsole/pages/mods/modals/modModalsSlice";
import { getErrorMessage } from "@/errors/errorHelpers";
import {
  useGetEditablePackagesQuery,
  useUpdateRecipeMutation,
} from "@/services/api";
import notify from "@/utils/notify";
import { produce } from "immer";
import ActivationLink from "@/activation/ActivationLink";
import { isSingleObjectBadRequestError } from "@/errors/networkErrorHelpers";
import { useOptionalRecipe } from "@/recipes/recipesHooks";
import PublishContentLayout from "./PublishContentLayout";
import { MARKETPLACE_URL } from "@/utils/strings";

const PublishRecipeContent: React.FunctionComponent = () => {
  const dispatch = useDispatch();
  const { blueprintId } = useSelector(selectShowPublishContext);
  const [updateRecipe] = useUpdateRecipeMutation();
  const { data: editablePackages, isFetching: isFetchingEditablePackages } =
    useGetEditablePackagesQuery();
  const { data: recipe, refetch: refetchRecipes } =
    useOptionalRecipe(blueprintId);

  const [isPublishing, setPublishing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const closeModal = () => {
    dispatch(modModalsSlice.actions.closeModal());
  };

  const publish = async () => {
    setPublishing(true);
    setError(null);

    try {
      const newRecipe = produce(recipe, (draft) => {
        draft.sharing.public = true;
      });

      const packageId = editablePackages.find(
        (x) => x.name === newRecipe.metadata.id
      )?.id;

      await updateRecipe({
        packageId,
        recipe: newRecipe,
      }).unwrap();

      notify.success("Shared brick");
      closeModal();
      refetchRecipes();
    } catch (error) {
      if (
        isSingleObjectBadRequestError(error) &&
        error.response.data.config?.length > 0
      ) {
        setError(error.response.data.config.join(" "));
      } else {
        const message = getErrorMessage(error);
        setError(message);

        notify.error({
          message,
          error,
        });
      }

      setPublishing(false);
    }
  };

  return (
    <PublishContentLayout title="Publish to Marketplace">
      <Modal.Body>
        {error && <div className="text-danger p-3">{error}</div>}

        <p>
          On Submit, the public link to this mod will be shared with the{" "}
          <a href={MARKETPLACE_URL} target="blank" rel="noreferrer noopener">
            PixieBrix Marketplace
          </a>{" "}
          admin team, who will review your submission and publish your mod.
        </p>
        <p>
          As soon as you Submit, the public link below will work for anyone, so
          you can start sharing right away!
        </p>

        <p className="mb-1">Public link to share:</p>
        <ActivationLink blueprintId={blueprintId} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="link" disabled={isPublishing} onClick={closeModal}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={isPublishing || isFetchingEditablePackages}
          onClick={publish}
        >
          Submit
        </Button>
      </Modal.Footer>
    </PublishContentLayout>
  );
};

export default PublishRecipeContent;
