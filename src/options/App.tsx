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

import React, { useEffect } from "react";
import store, { hashHistory, persistor } from "./store";
import { Provider, useSelector } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import GridLoader from "react-spinners/GridLoader";
import Container from "react-bootstrap/Container";
import ErrorBoundary from "@/components/ErrorBoundary";
import InstalledPage from "@/options/pages/installed/InstalledPage";
import ServicesEditor from "@/options/pages/services/ServicesEditor";
import BrickCreatePage from "@/options/pages/brickEditor/CreatePage";
import BrickEditPage from "@/options/pages/brickEditor/EditPage";
import MarketplacePage from "@/options/pages/MarketplacePage";
import SettingsPage from "@/options/pages/settings/SettingsPage";
import Navbar from "@/layout/Navbar";
import Footer from "@/layout/Footer";
import Sidebar from "@/layout/Sidebar";
import { Route, Switch } from "react-router-dom";
import { ConnectedRouter } from "connected-react-router";
import { ToastProvider } from "react-toast-notifications";
import "@/vendors/theme/app/app.scss";
import AuthContext from "@/auth/AuthContext";
import { useAsyncState } from "@/hooks/common";
import Banner from "@/layout/Banner";
import ErrorModal from "@/layout/ErrorModal";
import ActivateBlueprintPage from "@/options/pages/marketplace/ActivateBlueprintPage";
import ActivateExtensionPage from "@/options/pages/activateExtension/ActivatePage";
import { getAuth } from "@/hooks/auth";
import useRefresh from "@/hooks/useRefresh";
import { SettingsState } from "@/options/slices";
import { isLinked } from "@/auth/token";
import SetupPage from "@/options/pages/SetupPage";
import { AuthState } from "@/core";
import TemplatesPage from "@/options/pages/templates/TemplatesPage";
import { initTelemetry } from "@/telemetry/events";
import UpdateBanner from "@/options/pages/UpdateBanner";
import registerBuiltinBlocks from "@/blocks/registerBuiltinBlocks";
import registerContribBlocks from "@/contrib/registerContribBlocks";
import "@/contrib/editors";
import DeploymentBanner from "@/options/pages/deployments/DeploymentBanner";
import { ModalProvider } from "@/components/ConfirmationModal";
import WorkshopPage from "./pages/workshop/WorkshopPage";

// Register the built-in bricks
registerBuiltinBlocks();
registerContribBlocks();

const RequireInstall: React.FunctionComponent = ({ children }) => {
  const mode = useSelector<{ settings: SettingsState }, string>(
    ({ settings }) => settings.mode
  );
  const [linked, isPending] = useAsyncState(isLinked);

  if (isPending && mode === "remote") {
    return null;
  }

  if (mode === "remote" && !linked) {
    return <SetupPage />;
  }

  return <>{children}</>;
};

const Layout = () => {
  // Get the latest brick definitions. Currently in Layout to ensure the Redux store has been hydrated by the time
  // refresh is called.
  useRefresh();

  return (
    <div className="w-100">
      <Navbar />
      <Container fluid className="page-body-wrapper">
        <RequireInstall>
          <Sidebar />
          <div className="main-panel">
            <ErrorModal />
            <Banner />
            <UpdateBanner />
            <DeploymentBanner />
            <div className="content-wrapper">
              <ErrorBoundary>
                <Switch>
                  <Route
                    exact
                    path="/marketplace"
                    component={MarketplacePage}
                  />
                  <Route
                    exact
                    path="/extensions/install/:extensionId"
                    component={ActivateExtensionPage}
                  />
                  <Route exact path="/templates" component={TemplatesPage} />
                  <Route
                    exact
                    path="/:sourcePage/activate/:blueprintId"
                    component={ActivateBlueprintPage}
                  />
                  <Route exact path="/settings" component={SettingsPage} />
                  <Route path="/services/:id?" component={ServicesEditor} />
                  <Route exact path="/workshop" component={WorkshopPage} />
                  <Route
                    exact
                    path="/workshop/create/"
                    component={BrickCreatePage}
                  />
                  <Route
                    exact
                    path="/workshop/bricks/:id/"
                    component={BrickEditPage}
                  />
                  <Route component={InstalledPage} />
                </Switch>
              </ErrorBoundary>
            </div>
            <Footer />
          </div>
        </RequireInstall>
      </Container>
    </div>
  );
};

const defaultState: AuthState = {
  isLoggedIn: false,
  extension: true,
  isOnboarded: undefined,
  flags: [],
};

const App: React.FunctionComponent = () => {
  const [authState] = useAsyncState(getAuth);

  useEffect(() => {
    initTelemetry();
  }, []);

  return (
    <Provider store={store}>
      <PersistGate loading={<GridLoader />} persistor={persistor}>
        <AuthContext.Provider value={authState ?? defaultState}>
          <ConnectedRouter history={hashHistory}>
            <ModalProvider>
              <ToastProvider>
                <Layout />
              </ToastProvider>
            </ModalProvider>
          </ConnectedRouter>
        </AuthContext.Provider>
      </PersistGate>
    </Provider>
  );
};

export default App;
