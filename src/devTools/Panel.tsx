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
import { Button, Container } from "react-bootstrap";
import { HashRouter as Router } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { DevToolsContext, useDevConnection } from "@/devTools/context";
import GridLoader from "react-spinners/GridLoader";
import Editor from "@/devTools/Editor";

import store, { persistor, RootState } from "./store";
import { PersistGate } from "redux-persist/integration/react";
import { Provider, useSelector } from "react-redux";
import { useAsyncState } from "@/hooks/common";
import { getAuth } from "@/hooks/auth";
import AuthContext from "@/auth/AuthContext";
import { ToastProvider } from "react-toast-notifications";
import useAsyncEffect from "use-async-effect";
import blockRegistry from "@/blocks/registry";
import ScopeSettings from "@/devTools/ScopeSettings";
import { AuthState } from "@/core";
import Centered from "@/devTools/editor/components/Centered";

// Import bricks for the registry
import "@/blocks/effects";
import "@/blocks/readers";
import "@/blocks/transformers";
import "@/blocks/renderers";
import "@/contrib/index";
import "@/contrib/editors";
import { ModalProvider } from "@/components/ConfirmationModal";

const defaultState: AuthState = {
  isLoggedIn: false,
  extension: true,
  isOnboarded: undefined,
  flags: [],
};

const PersistLoader: React.FunctionComponent = () => {
  return (
    <Centered>
      <div className="d-flex justify-content-center">
        <GridLoader />
      </div>
    </Centered>
  );
};

const RequireScope: React.FunctionComponent<{ scope: string | null }> = ({
  scope,
  children,
}) => {
  const mode = useSelector<RootState, string>(({ settings }) => settings.mode);

  if (mode !== "local" && (scope === "" || !scope)) {
    return <ScopeSettings />;
  }

  return <>{children}</>;
};

const Panel: React.FunctionComponent = () => {
  const [authState, , authError] = useAsyncState(getAuth);
  const context = useDevConnection();

  useAsyncEffect(async () => {
    await blockRegistry.fetch();
  }, []);

  if (authError) {
    return (
      <Centered>
        <div className="PaneTitle">Error authenticating account</div>
        <div>{authError?.toString() ?? "Unknown error"}</div>
        <Button onClick={() => location.reload()}>Reload Editor</Button>
      </Centered>
    );
  }

  if (context.portError || context.tabState.error) {
    return (
      <Centered>
        <div className="PaneTitle">
          <b>An error occurred</b>
        </div>
        <div>{context.portError ?? context.tabState?.error}</div>
        <div className="mt-2">
          <Button onClick={() => location.reload()}>Reload Editor</Button>
        </div>
      </Centered>
    );
  }

  if (!context.port) {
    return (
      <Centered>
        <p>Initializing connection...</p>
        <div className="d-flex justify-content-center">
          <GridLoader />
        </div>
      </Centered>
    );
  }

  return (
    <Provider store={store}>
      <PersistGate loading={<PersistLoader />} persistor={persistor}>
        <AuthContext.Provider value={authState ?? defaultState}>
          <DevToolsContext.Provider value={context}>
            <ToastProvider>
              <ModalProvider>
                <ErrorBoundary>
                  <Router>
                    <Container fluid className="DevToolsContainer">
                      <RequireScope scope={authState?.scope}>
                        <Editor />
                      </RequireScope>
                    </Container>
                  </Router>
                </ErrorBoundary>
              </ModalProvider>
            </ToastProvider>
          </DevToolsContext.Provider>
        </AuthContext.Provider>
      </PersistGate>
    </Provider>
  );
};

export default Panel;
