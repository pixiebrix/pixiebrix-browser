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

import React, { useEffect } from "react";
import { useSelector } from "react-redux";
import { selectSessionId } from "@/pageEditor/slices/sessionSelectors";
import reportEvent from "@/telemetry/reportEvent";
import { Events } from "@/telemetry/events";
import { useGetMarketplaceListingsQuery } from "@/data/service/api";
import NoTabAccessPane from "@/pageEditor/panes/NoTabAccessPane";
import BetaPane from "@/pageEditor/panes/BetaPane";
import EditorPane from "@/pageEditor/panes/EditorPane";
import ModEditorPane from "@/pageEditor/panes/ModEditorPane";
import HomePane from "@/pageEditor/panes/HomePane";
import {
  selectActiveElementId,
  selectActiveRecipeId,
  selectErrorState,
  selectExtensionAvailability,
} from "@/pageEditor/slices/editorSelectors";
import {
  selectTabHasPermissions,
  selectTabIsConnectingToContentScript,
} from "@/pageEditor/tabState/tabStateSelectors";
import useCurrentUrl from "@/pageEditor/hooks/useCurrentUrl";
import { getErrorMessage } from "@/errors/errorHelpers";
import Alert from "@/components/Alert";
import styles from "./EditorContent.module.scss";
import { selectPageEditorDimensions } from "@/pageEditor/utils";

const EditorContent: React.FC = () => {
  const tabHasPermissions = useSelector(selectTabHasPermissions);
  const isConnectingToContentScript = useSelector(
    selectTabIsConnectingToContentScript,
  );
  const sessionId = useSelector(selectSessionId);
  const { isBetaError, editorError } = useSelector(selectErrorState);
  const activeElementId = useSelector(selectActiveElementId);
  const activeRecipeId = useSelector(selectActiveRecipeId);
  const { isPendingInstalledExtensions, isPendingDynamicExtensions } =
    useSelector(selectExtensionAvailability);

  const url = useCurrentUrl();

  useEffect(() => {
    console.debug("EditorContent debug effect", {
      url,
      isPendingInstalledExtensions,
      isPendingDynamicExtensions,
      isConnectingToContentScript,
    });
  }, [
    url,
    isPendingInstalledExtensions,
    isPendingDynamicExtensions,
    isConnectingToContentScript,
  ]);

  const isPendingExtensions =
    isPendingInstalledExtensions || isPendingDynamicExtensions;

  // Fetch-and-cache marketplace content for rendering in the Brick Selection modal
  useGetMarketplaceListingsQuery();

  useEffect(() => {
    reportEvent(Events.PAGE_EDITOR_SESSION_START, {
      sessionId,
      ...selectPageEditorDimensions(),
    });

    // Report session end before page unload instead of component unmount because closing the
    // devtools will prevent the component from unmounting
    window.addEventListener("beforeunload", () => {
      reportEvent(Events.PAGE_EDITOR_SESSION_END, {
        sessionId,
        ...selectPageEditorDimensions(),
      });
    });
  }, [sessionId]);

  // Always show the main error if present - keep this first
  if (editorError) {
    return (
      <div className={styles.alertContainer}>
        <Alert variant="danger">{getErrorMessage(editorError)}</Alert>
      </div>
    );
  }

  if (!tabHasPermissions && !isConnectingToContentScript) {
    // Check `connecting` to optimistically show the main interface while the devtools are connecting to the page.
    return <NoTabAccessPane />;
  }

  // Show generic error for beta features
  if (isBetaError) {
    return <BetaPane />;
  }

  if (activeElementId) {
    return <EditorPane />;
  }

  if (activeRecipeId) {
    return <ModEditorPane />;
  }

  if (isPendingExtensions || isConnectingToContentScript) {
    // Avoid flashing the panes below while the state is loading. This condition should probably
    // not be moved below <HomePane>
    // It loads fast enough to not require a <Loader> either.
    // https://github.com/pixiebrix/pixiebrix-extension/pull/3611
    return null;
  }

  return <HomePane />;
};

export default EditorContent;
