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
import React, { useCallback, useContext, useMemo } from "react";
import Sidebar from "@/devTools/editor/sidebar/Sidebar";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/devTools/store";
import { DevToolsContext } from "@/devTools/context";
import { selectExtensions } from "@/store/extensionsSelectors";
import PermissionsPane from "@/devTools/editor/panes/PermissionsPane";
import BetaPane from "@/devTools/editor/panes/BetaPane";
import InsertMenuItemPane from "@/devTools/editor/panes/insert/InsertMenuItemPane";
import InsertPanelPane from "@/devTools/editor/panes/insert/InsertPanelPane";
import NoExtensionSelectedPane from "@/devTools/editor/panes/NoExtensionsSelectedPane";
import NoExtensionsPane from "@/devTools/editor/panes/NoExtensionsPane";
import WelcomePane from "@/devTools/editor/panes/WelcomePane";
import EditorPane from "@/devTools/editor/panes/EditorPane";
import useInstallState from "@/devTools/editor/hooks/useInstallState";
import useEscapeHandler from "@/devTools/editor/hooks/useEscapeHandler";
import GenericInsertPane from "@/devTools/editor/panes/insert/GenericInsertPane";
import { ADAPTERS } from "@/devTools/editor/extensionPoints/adapter";
import { actions } from "@/devTools/editor/slices/editorSlice";
import { useGetMarketplaceListingsQuery } from "@/services/api";
import { cancelSelect } from "@/contentScript/messenger/api";
import { thisTab } from "@/devTools/utils";
import styles from "./Editor.module.scss";
import { selectActiveElement } from "@/devTools/editor/slices/editorSelectors";

const selectEditor = ({ editor }: RootState) => editor;

const Editor: React.FunctionComponent = () => {
  const { tabState, connecting } = useContext(DevToolsContext);
  const installed = useSelector(selectExtensions);
  const dispatch = useDispatch();

  // Async fetch marketplace content to the Redux so it's pre-fetched for rendering in the Brick Selection modal
  useGetMarketplaceListingsQuery();

  const {
    selectionSeq,
    inserting,
    elements,
    activeElement,
    error,
    beta,
  } = useSelector(selectEditor);

  const selectedElement = useSelector(selectActiveElement);

  const cancelInsert = useCallback(async () => {
    dispatch(actions.toggleInsert(null));
    await cancelSelect(thisTab);
  }, [dispatch]);

  useEscapeHandler(cancelInsert, inserting != null);

  const { availableDynamicIds, unavailableCount } = useInstallState(
    installed,
    elements
  );

  const body = useMemo(() => {
    // Need to explicitly check for `false` because hasPermissions will be undefined if pending/error
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare
    if (tabState.hasPermissions === false && !connecting) {
      // Check `connecting` to optimistically show the main interface while the devtools are connecting to the page.
      return <PermissionsPane />;
    }

    if (error && beta) {
      return <BetaPane />;
    }

    if (inserting) {
      switch (inserting) {
        case "menuItem":
          return <InsertMenuItemPane cancel={cancelInsert} />;
        case "panel":
          return <InsertPanelPane cancel={cancelInsert} />;
        default:
          return (
            <GenericInsertPane
              cancel={cancelInsert}
              config={ADAPTERS.get(inserting)}
            />
          );
      }
    } else if (error) {
      return (
        <div className="p-2">
          <span className="text-danger">{error}</span>
        </div>
      );
    } else if (selectedElement) {
      return (
        <EditorPane
          selectedElement={selectedElement}
          selectionSeq={selectionSeq}
        />
      );
    } else if (
      availableDynamicIds?.size ||
      installed.length > unavailableCount
    ) {
      return <NoExtensionSelectedPane />;
    } else if (installed.length > 0) {
      return <NoExtensionsPane unavailableCount={unavailableCount} />;
    } else {
      return <WelcomePane />;
    }
  }, [
    connecting,
    beta,
    cancelInsert,
    inserting,
    selectedElement,
    error,
    installed,
    selectionSeq,
    availableDynamicIds?.size,
    unavailableCount,
    tabState,
  ]);

  return (
    <div className={styles.root}>
      <Sidebar
        installed={installed}
        elements={elements}
        activeElement={activeElement}
        isInsertingElement={Boolean(inserting)}
      />
      {body}
    </div>
  );
};

export default Editor;
