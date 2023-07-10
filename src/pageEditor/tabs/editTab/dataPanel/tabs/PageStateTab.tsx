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
import JsonTree from "@/components/jsonTree/JsonTree";
import { getPageState } from "@/contentScript/messenger/api";
import { getErrorMessage } from "@/errors/errorHelpers";
import { selectActiveElement } from "@/pageEditor/slices/editorSelectors";
import { thisTab } from "@/pageEditor/utils";
import { faExternalLinkAlt, faSync } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "react-bootstrap";
import { useSelector } from "react-redux";
import { type UnknownObject } from "@/types/objectTypes";
import { DataPanelTabKey } from "@/pageEditor/tabs/editTab/dataPanel/dataPanelTypes";
import DataTab from "@/pageEditor/tabs/editTab/dataPanel/DataTab";
import useAsyncState from "@/hooks/useAsyncState";
import { type ShouldExpandNodeInitially } from "react-json-tree";

// We used to expand nodes initially. But makes state hard to read when using async state with long values, e.g.,
// ChatGPT responses
const expandTopLevelNodes: ShouldExpandNodeInitially = (keyPath, data, level) =>
  level <= 1;

const PageStateTab: React.VFC = () => {
  const activeElement = useSelector(selectActiveElement);

  const state = useAsyncState<{
    Private: UnknownObject | string;
    Mod: UnknownObject | string;
    Public: UnknownObject | string;
  }>(
    async () => {
      const context = {
        extensionId: activeElement.uuid,
        blueprintId: activeElement.recipe?.id,
      };

      const [shared, mod, local] = await Promise.all([
        getPageState(thisTab, { namespace: "shared", ...context }),
        activeElement.recipe
          ? getPageState(thisTab, { namespace: "blueprint", ...context })
          : Promise.resolve("Starter Brick is not in a mod"),
        getPageState(thisTab, { namespace: "extension", ...context }),
      ]);

      return {
        Private: local,
        Mod: mod,
        Public: shared,
      };
    },
    [],
    {
      initialValue: {
        Private: "Loading...",
        Mod: "Loading...",
        Public: "Loading...",
      },
    }
  );

  return (
    <DataTab eventKey={DataPanelTabKey.PageState}>
      <div className="mb-1 d-flex">
        <div>
          <Button
            variant="info"
            size="sm"
            disabled={state.isFetching}
            onClick={state.refetch}
          >
            <FontAwesomeIcon icon={faSync} /> Refresh
          </Button>
        </div>
        <div className="ml-2">
          <a
            href="https://docs.pixiebrix.com/page-state"
            target="_blank"
            rel="noreferrer"
          >
            <small>
              <FontAwesomeIcon icon={faExternalLinkAlt} />
              &nbsp;Learn more about Page State
            </small>
          </a>
        </div>
      </div>
      {state.isError ? (
        <div>
          <div className="text-danger">Error</div>
          <p>{getErrorMessage(state.error)}</p>
        </div>
      ) : (
        <JsonTree
          data={state.data}
          copyable={false}
          shouldExpandNodeInitially={expandTopLevelNodes}
        />
      )}
    </DataTab>
  );
};

export default PageStateTab;
