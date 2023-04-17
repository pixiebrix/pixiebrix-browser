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

import React, { useCallback, useEffect, useRef, useState } from "react";
import { type RegistryId } from "@/types/registryTypes";
import { useGetMarketplaceListingsQuery } from "@/services/api";
import Loader from "@/components/Loader";
import { useRecipe } from "@/recipes/recipesHooks";
import activationCompleteImage from "@img/blueprint-activation-complete.png";
import styles from "./ActivateRecipePanel.module.scss";
import AsyncButton from "@/components/AsyncButton";
import { useDispatch, useSelector } from "react-redux";
import sidebarSlice from "@/sidebar/sidebarSlice";
import { hideSidebar } from "@/contentScript/messenger/api";
import { getTopLevelFrame } from "webext-messenger";
import cx from "classnames";
import { isEmpty, uniq } from "lodash";
import { PIXIEBRIX_SERVICE_ID } from "@/services/constants";
import ActivateRecipeInputs from "@/sidebar/activateRecipe/ActivateRecipeInputs";
import { selectExtensionsForRecipe } from "@/store/extensionsSelectors";
import { useAsyncState } from "@/hooks/common";
import { resolveRecipe } from "@/registry/internal";
import { useAsyncEffect } from "use-async-effect";
import includesQuickBarExtensionPoint from "@/utils/includesQuickBarExtensionPoint";
import useQuickbarShortcut from "@/hooks/useQuickbarShortcut";
import { openShortcutsTab, SHORTCUTS_URL } from "@/chrome";
import { Button } from "react-bootstrap";
import useMarketplaceActivateRecipe from "@/sidebar/activateRecipe/useMarketplaceActivateRecipe";
import { type WizardValues } from "@/activation/wizardTypes";

const { actions } = sidebarSlice;

type ActivateRecipePanelProps = {
  recipeId: RegistryId;
};

const ShortcutKeys: React.FC<{ shortcut: string | null }> = ({ shortcut }) => {
  const shortcutKeys = shortcut?.split("") ?? [];
  return (
    <div className={styles.shortcutContainer}>
      {shortcutKeys.map((key, index) => (
        <React.Fragment key={key}>
          {index > 0 && <span>&nbsp;&nbsp;+&nbsp;&nbsp;</span>}
          <span className={styles.shortcutKey}>{key}</span>
        </React.Fragment>
      ))}
    </div>
  );
};

const ActivateRecipePanel: React.FC<ActivateRecipePanelProps> = ({
  recipeId,
}) => {
  const dispatch = useDispatch();
  const activateRecipe = useMarketplaceActivateRecipe();
  const [activateError, setActivateError] = useState<string | null>(null);

  const {
    data: recipe,
    isLoading,
    isUninitialized,
    error: recipeError,
  } = useRecipe(recipeId);

  const isLoadingRecipe = isUninitialized || isLoading;

  // Quick Bar affordances
  const [includesQuickbar, setIncludesQuickbar] = useState(false);
  const [resolvedRecipeConfigs] = useAsyncState(
    async () => resolveRecipe(recipe, recipe.extensionPoints),
    [recipe]
  );
  useAsyncEffect(async () => {
    setIncludesQuickbar(
      await includesQuickBarExtensionPoint(resolvedRecipeConfigs)
    );
  }, [resolvedRecipeConfigs]);
  const { shortcut } = useQuickbarShortcut();

  const {
    data: listings,
    isLoading: isLoadingListing,
    error: listingError,
  } = useGetMarketplaceListingsQuery({ package__name: recipeId });
  // eslint-disable-next-line security/detect-object-injection -- RegistryId
  const listing = listings?.[recipeId];

  if (recipeError || listingError) {
    throw recipeError ?? listingError;
  }

  let isReinstall = false;
  const recipeExtensions = useSelector(selectExtensionsForRecipe(recipeId));
  if (!isEmpty(recipeExtensions)) {
    isReinstall = true;
  }

  const recipeName =
    listing?.package?.verbose_name ?? listing?.package?.name ?? "Unnamed mod";
  const recipeNameComponent = (
    <div className={styles.recipeName}>{recipeName}</div>
  );

  const hasRecipeOptions = !isEmpty(recipe?.options?.schema?.properties);
  const recipeServiceIds = uniq(
    recipe?.extensionPoints.flatMap(({ services }) =>
      services ? Object.values(services) : []
    ) ?? []
  );
  const needsServiceInputs = recipeServiceIds.some(
    (serviceId) => serviceId !== PIXIEBRIX_SERVICE_ID
  );

  const [isActivating, setIsActivating] = useState(false);
  const [recipeActivated, setRecipeActivated] = useState(false);
  const activateFormValues = useRef<WizardValues>();

  const activate = useCallback(async () => {
    if (recipeActivated) {
      return;
    }

    setIsActivating(true);
    setActivateError(null);

    const result = await activateRecipe(activateFormValues.current, recipe);
    if (result.success) {
      setRecipeActivated(true);
    } else {
      setRecipeActivated(false);
      setActivateError(result.error);
    }

    setIsActivating(false);
  }, [activateRecipe, recipe, recipeActivated]);

  useEffect(() => {
    if (
      !recipeActivated &&
      !isLoadingRecipe &&
      !recipeError &&
      !isActivating &&
      // Need to wait for the listing to load also so that the submit button renders
      !isLoadingListing &&
      // If the recipe doesn't have options or services, we can activate immediately
      !hasRecipeOptions &&
      !needsServiceInputs &&
      activateFormValues.current
    ) {
      void activate();
    }
  }, [
    activate,
    hasRecipeOptions,
    isActivating,
    isLoadingListing,
    isLoadingRecipe,
    needsServiceInputs,
    recipeActivated,
    recipeError,
  ]);

  useEffect(() => {
    if (
      !isLoadingRecipe &&
      !isLoadingListing &&
      !isActivating &&
      !recipeActivated
    ) {
      console.log("where am i");
    }
  }, [isLoadingListing, isLoadingRecipe, isActivating, recipeActivated]);

  if (isLoadingRecipe || isLoadingListing || isActivating) {
    return <Loader />;
  }

  if (recipe == null) {
    throw new Error(`Recipe ${recipeId} not found`);
  }

  async function closeSidebar() {
    dispatch(actions.hideActivateRecipe());
    const topFrame = await getTopLevelFrame();
    void hideSidebar(topFrame);
  }

  return (
    <div className={styles.root}>
      {recipeActivated ? (
        <>
          <div className={cx("scrollable-area", styles.content)}>
            <h1>Well done!</h1>
            <img src={activationCompleteImage} alt="" width={300} />
            <div className={styles.textContainer}>
              {recipeNameComponent}
              <div>is ready to use!</div>
              <br />
              {includesQuickbar ? (
                isEmpty(shortcut) ? (
                  <span>
                    Now just{" "}
                    <Button
                      variant="link"
                      href={SHORTCUTS_URL}
                      onClick={(event) => {
                        // `react-bootstrap` will render as an anchor tag when href is set
                        // Can't link to chrome:// URLs directly
                        event.preventDefault();
                        void openShortcutsTab();
                      }}
                      className={styles.configureLink}
                    >
                      Configure your Quick Bar shortcut
                    </Button>{" "}
                    to access this mod.
                  </span>
                ) : (
                  <>
                    <div>Launch it using your Quick Bar shortcut</div>
                    <ShortcutKeys shortcut={shortcut} />
                    <Button
                      variant="link"
                      href={SHORTCUTS_URL}
                      onClick={(event) => {
                        // `react-bootstrap` will render as an anchor tag when href is set
                        // Can't link to chrome:// URLs directly
                        event.preventDefault();
                        void openShortcutsTab();
                      }}
                    >
                      Change the Quick Bar shortcut.
                    </Button>
                  </>
                )
              ) : (
                <div>Go try it out now, or activate another mod.</div>
              )}
            </div>
          </div>
          <div className={styles.footer}>
            <AsyncButton onClick={closeSidebar}>Ok</AsyncButton>
          </div>
        </>
      ) : (
        <ActivateRecipeInputs
          recipe={recipe}
          isReinstall={isReinstall}
          onClickCancel={closeSidebar}
          header={
            <>
              {recipeNameComponent}
              <p>
                {
                  "We're almost there. This mod has a few settings to configure before using. You can always change these later."
                }
              </p>
            </>
          }
          formValuesRef={activateFormValues}
          onClickSubmit={() => {
            void activate();
          }}
          activateError={activateError}
        />
      )}
    </div>
  );
};

export default ActivateRecipePanel;
