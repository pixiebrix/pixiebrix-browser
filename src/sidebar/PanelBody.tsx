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

import React, { useReducer } from "react";
import Loader from "@/components/Loader";
import blockRegistry from "@/blocks/registry";
import EmotionShadowRoot from "react-shadow/emotion";
import { getErrorMessage, selectSpecificError } from "@/errors/errorHelpers";
import {
  isRendererErrorPayload,
  isRendererLoadingPayload,
  type PanelContext,
  type PanelPayload,
  type PanelRunMeta,
} from "@/types/sidebarTypes";
import RendererComponent from "@/sidebar/RendererComponent";
import { BusinessError, CancelError } from "@/errors/businessErrors";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { useAsyncEffect } from "use-async-effect";
import RootCancelledPanel from "@/sidebar/components/RootCancelledPanel";
import RootErrorPanel from "@/sidebar/components/RootErrorPanel";
import BackgroundLogger from "@/telemetry/BackgroundLogger";
import { type SubmitPanelAction } from "@/blocks/errors";
import { type RegistryId } from "@/types/registryTypes";
import { type RendererOutput } from "@/types/runtimeTypes";
import { unsafeAssumeValidArg } from "@/runtime/runtimeTypes";
import { isEmpty } from "lodash";
import DelayedRender from "@/components/DelayedRender";

// Used for the loading message
// import cx from "classnames";
// import styles from "./PanelBody.module.scss";

type BodyProps = {
  blockId: RegistryId;
  body: RendererOutput;
  meta: PanelRunMeta;
};

const BodyContainer: React.FC<
  // In the future, may want to support providing isFetching to show a loading indicator/badge over the previous content
  BodyProps & { onAction: (action: SubmitPanelAction) => void }
> = ({ blockId, body, onAction, meta }) => (
  // Use a shadow dom to prevent the webpage styles from affecting the sidebar
  <EmotionShadowRoot.div className="full-height" data-block-id={blockId}>
    <RendererComponent
      blockId={blockId}
      body={body}
      meta={meta}
      onAction={onAction}
    />
  </EmotionShadowRoot.div>
);

type State = {
  /**
   * Data about the component to display
   */
  component: BodyProps | null;
  /**
   * True if the panel is loading the first time
   */
  isLoading: boolean;
  /**
   * True if the panel is recalculating
   */
  isFetching: boolean;
  /**
   * Error to display from running the renderer
   */
  error: unknown;
  /**
   * Optional customized loading message to display in the panel
   */
  loadingMessage?: string;
};

const initialPanelState: State = {
  component: null,
  isLoading: true,
  isFetching: true,
  error: null,
};

const slice = createSlice({
  name: "panelSlice",
  initialState: initialPanelState,
  reducers: {
    setLoadingMessage(state, action: PayloadAction<string>) {
      state.loadingMessage = action.payload;
    },
    reactivate(state) {
      // Don't clear out the component/error, because we want to keep showing the old component while the panel is
      // reloading
      state.isFetching = true;
    },
    success(state, action: PayloadAction<{ data: BodyProps }>) {
      state.isLoading = false;
      state.isFetching = false;
      state.component = action.payload.data;
      state.error = null;
    },
    failure(state, action: PayloadAction<{ error: unknown }>) {
      state.isLoading = false;
      state.isFetching = false;
      state.component = null;
      state.error = action.payload.error ?? "Error rendering component";
    },
  },
});

const PanelBody: React.FunctionComponent<{
  isRootPanel?: boolean;
  payload: PanelPayload;
  context: PanelContext;
  onAction: (action: SubmitPanelAction) => void;
}> = ({ payload, context, isRootPanel = false, onAction }) => {
  const [state, dispatch] = useReducer(slice.reducer, initialPanelState);

  useAsyncEffect(
    async (isMounted) => {
      if (payload == null) {
        dispatch(slice.actions.reactivate());
        return;
      }

      if (isRendererErrorPayload(payload)) {
        dispatch(slice.actions.failure({ error: payload.error }));
        return;
      }

      if (isRendererLoadingPayload(payload)) {
        if (!isEmpty(payload.loadingMessage)) {
          dispatch(slice.actions.setLoadingMessage(payload.loadingMessage));
        }

        return;
      }

      try {
        // In most cases reactivate would have already been called for the payload == null branch. But confirm it here
        dispatch(slice.actions.reactivate());

        const { blockId, ctxt, args, runId, extensionId } = payload;

        console.debug("Running panel body for panel payload", payload);

        const block = await blockRegistry.lookup(blockId);
        // In the future, the renderer brick should run in the contentScript, not the panel frame
        // TODO: https://github.com/pixiebrix/pixiebrix-extension/issues/1939
        const body = await block.run(unsafeAssumeValidArg(args), {
          ctxt,
          root: null,
          logger: new BackgroundLogger({
            ...context,
            blockId,
          }),
          async runPipeline() {
            throw new BusinessError(
              "Support for running pipelines in panels not implemented"
            );
          },
          async runRendererPipeline() {
            throw new BusinessError(
              "Support for running pipelines in panels not implemented"
            );
          },
        });

        if (!runId || !extensionId) {
          console.warn("PanelBody requires runId in RendererPayload", {
            payload,
          });
        }

        if (!isMounted()) {
          return;
        }

        dispatch(
          slice.actions.success({
            data: {
              blockId,
              body: body as RendererOutput,
              meta: { runId, extensionId },
            },
          })
        );
      } catch (error) {
        dispatch(slice.actions.failure({ error }));
      }
    },
    [payload?.key, dispatch]
  );

  // Only show loader on initial render. Otherwise, just overlay a loading indicator over the other panel to
  // avoid remounting the whole generated component. Some components maybe have long initialization times. E.g., our
  // Document Builder loads Bootstrap into the Shadow DOM
  if (state.isLoading) {
    // TODO: wire up loading message to be configured somewhere
    // if (state.loadingMessage) {
    //   return (
    //     <div className={cx("text-muted", styles.loadingMessage)}>
    //       {state.loadingMessage}
    //     </div>
    //   );
    // }

    return (
      <DelayedRender millis={600}>
        <Loader />
      </DelayedRender>
    );
  }

  if (state.error) {
    const cancelError = selectSpecificError(state.error, CancelError);

    if (cancelError) {
      return (
        <>
          {state.isFetching && <Loader size={8} />}
          {isRootPanel ? (
            <RootCancelledPanel error={cancelError} />
          ) : (
            <div className="text-muted">
              This panel is not available: {getErrorMessage(state.error)}
            </div>
          )}
        </>
      );
    }

    return (
      <>
        {state.isFetching && <Loader size={8} />}
        {isRootPanel ? (
          <RootErrorPanel error={state.error} />
        ) : (
          <div className="text-danger">
            Error rendering panel: {getErrorMessage(state.error)}
          </div>
        )}
      </>
    );
  }

  return <BodyContainer {...state.component} onAction={onAction} />;
};

export default PanelBody;
