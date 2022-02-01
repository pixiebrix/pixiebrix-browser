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

import React, { useCallback, useContext } from "react";
import { BlockPipeline } from "@/blocks/types";
import AsyncButton, { AsyncButtonProps } from "@/components/AsyncButton";
import { whoAmI } from "@/background/messenger/api";
import { runEffectPipeline } from "@/contentScript/messenger/api";
import { uuidv4 } from "@/types/helpers";
import DocumentContext from "@/components/documentBuilder/render/DocumentContext";
import { Except } from "type-fest";
import apiVersionOptions from "@/runtime/apiVersionOptions";

type ButtonElementProps = Except<AsyncButtonProps, "onClick"> & {
  onClick: BlockPipeline;
};

const ButtonElement: React.FC<ButtonElementProps> = ({
  onClick,
  ...restProps
}) => {
  const context = useContext(DocumentContext);

  const handler = useCallback(async () => {
    const me = await whoAmI();
    // We currently only support associating the sidebar with the content script in the top-level frame (frameId: 0)
    return runEffectPipeline(
      { tabId: me.tab.id, frameId: 0 },
      {
        nonce: uuidv4(),
        context: context.options.ctxt,
        pipeline: onClick,
        // TODO: pass runtime version via DocumentContext instead of hard-coding it. This will break for v4+
        options: apiVersionOptions("v3"),
      }
    );
  }, [onClick, context]);

  return <AsyncButton onClick={handler} {...restProps} />;
};

export default ButtonElement;
