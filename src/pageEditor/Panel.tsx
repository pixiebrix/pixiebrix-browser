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

import React, { useEffect } from "react";
import { HashRouter as Router } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { PageEditorTabContext, useDevConnection } from "@/pageEditor/context";
import Editor from "@/pageEditor/Editor";
import store, { persistor } from "./store";
import { PersistGate } from "redux-persist/integration/react";
import { Provider, useSelector } from "react-redux";
import { useAsyncEffect } from "use-async-effect";
import blockRegistry from "@/blocks/registry";
import { ModalProvider } from "@/components/ConfirmationModal";
import registerBuiltinBlocks from "@/blocks/registerBuiltinBlocks";
import registerContribBlocks from "@/contrib/registerContribBlocks";

// Import custom options widgets/forms for the built-in bricks
import registerEditors from "@/contrib/editors";
import Loader from "@/components/Loader";
import ErrorBanner from "@/pageEditor/ErrorBanner";
import registerDefaultWidgets from "@/components/fields/schemaFields/widgets/registerDefaultWidgets";
import { reportEvent } from "@/telemetry/events";
import { selectSessionId } from "@/pageEditor/slices/sessionSelectors";

// Register the built-in bricks
registerEditors();
registerContribBlocks();
registerBuiltinBlocks();

// Register Widgets
registerDefaultWidgets();

const Panel: React.VoidFunctionComponent = () => {
  const context = useDevConnection();
  const sessionId = useSelector(selectSessionId);

  useAsyncEffect(async () => {
    await blockRegistry.fetch();
  }, []);

  useEffect(() => {
    reportEvent("PageEditorSessionStart", {
      sessionId,
    });

    return () => {
      reportEvent("PageEditorSessionEnd", {
        sessionId,
      });
    };
  }, [sessionId]);

  return (
    <Provider store={store}>
      <PersistGate loading={<Loader />} persistor={persistor}>
        <PageEditorTabContext.Provider value={context}>
          <ModalProvider>
            <ErrorBoundary>
              <Router>
                <ErrorBanner />
                <Editor />
              </Router>
            </ErrorBoundary>
          </ModalProvider>
        </PageEditorTabContext.Provider>
      </PersistGate>
    </Provider>
  );
};

export default Panel;
