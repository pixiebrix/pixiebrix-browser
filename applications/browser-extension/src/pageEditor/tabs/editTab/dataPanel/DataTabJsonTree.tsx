/*
 * Copyright (C) 2024 PixieBrix, Inc.
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

import JsonTree, {
  type JsonTreeProps,
  type TreeExpandedState,
} from "@/components/jsonTree/JsonTree";
import { selectNodeDataPanelTabState } from "../../../store/editor/editorSelectors";
import React, { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type Except } from "type-fest";
import { type DataPanelTabKey } from "./dataPanelTypes";
import { actions } from "../../../store/editor/editorSlice";
import { type RootState } from "../../../store/editor/pageEditorTypes";
import cx from "classnames";
import styles from "./DataTabJsonTree.module.scss";

type DataTabJsonTreeProps = Except<
  JsonTreeProps,
  | "initialSearchQuery"
  | "onSearchQueryChange"
  | "initialExpandedState"
  | "onExpandedStateChange"
> & {
  tabKey: DataPanelTabKey;
};

/**
 * JSON tree connected to the Page Editor Redux store.
 */
const DataTabJsonTree: React.FunctionComponent<DataTabJsonTreeProps> = ({
  tabKey,
  ...jsonTreeProps
}) => {
  const dispatch = useDispatch();

  const { query, treeExpandedState } =
    useSelector((state: RootState) =>
      selectNodeDataPanelTabState(state, tabKey),
    ) ?? {};

  const setQuery = useCallback(
    (query: string) => {
      dispatch(actions.setNodeDataPanelTabSearchQuery({ tabKey, query }));
    },
    [dispatch, tabKey],
  );

  const onExpandedStateChange = useCallback(
    (nextExpandedState: TreeExpandedState) => {
      // Setting the state for the first time causes an error:
      // Cannot update a component (`Sidebar`) while rendering a different component (`JSONNestedNode`).
      // If we skip the current cycle, React feels ok.
      setTimeout(() => {
        dispatch(
          actions.setNodeDataPanelTabExpandedState({
            tabKey,
            expandedState: nextExpandedState,
          }),
        );
      }, 50);
    },
    [dispatch, tabKey],
  );

  return (
    <JsonTree
      {...jsonTreeProps}
      className={cx(jsonTreeProps.className, styles.dataTabRoot)}
      initialSearchQuery={query}
      onSearchQueryChange={setQuery}
      initialExpandedState={treeExpandedState}
      onExpandedStateChange={onExpandedStateChange}
    />
  );
};

export default DataTabJsonTree;
