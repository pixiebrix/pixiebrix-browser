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

import React from "react";
import GridLoader from "react-spinners/GridLoader";
import blockRegistry from "@/blocks/registry";
import { useAsyncState } from "@/hooks/common";
import ConsoleLogger from "@/tests/ConsoleLogger";
import ReactShadowRoot from "react-shadow-root";
import { getErrorMessage } from "@/errors";
import { BlockArg, RendererOutput } from "@/core";
import { PanelPayload } from "@/actionPanel/actionPanelTypes";
import RendererComponent from "@/actionPanel/RendererComponent";

const PanelBody: React.FunctionComponent<{ payload: PanelPayload }> = ({
  payload,
}) => {
  const [component, pending, error] = useAsyncState(async () => {
    if (!payload) {
      return null;
    }

    if ("error" in payload) {
      const { error } = payload;
      return (
        <div className="text-danger p-3">Error running panel: {error}</div>
      );
    }

    const { blockId, ctxt, args } = payload;
    console.debug("Render panel body", payload);
    const block = await blockRegistry.lookup(blockId);
    const body = await block.run(args as BlockArg, {
      ctxt,
      root: null,
      // TODO: use the correct logger here so the errors show up in the logs
      logger: new ConsoleLogger({ blockId }),
    });
    return (
      <div className="h-100">
        <ReactShadowRoot>
          <RendererComponent body={body as RendererOutput} />
        </ReactShadowRoot>
      </div>
    );
  }, [payload?.key]);

  if (error) {
    return (
      <div className="text-danger">
        Error rendering panel: {getErrorMessage(error as Error)}
      </div>
    );
  }

  if (pending || component == null) {
    return <GridLoader />;
  }

  return component;
};

export default PanelBody;
