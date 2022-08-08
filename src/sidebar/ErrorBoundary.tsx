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

import React, { Component } from "react";
import { isExtensionContext } from "webext-detect-page";
import { getErrorMessage } from "@/errors/errorHelpers";
import reportError from "@/telemetry/reportError";
import { UnknownObject } from "@/types";
import { isEmpty } from "lodash";
import { faRedo } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Alert, Button } from "react-bootstrap";
import { whoAmI } from "@/background/messenger/api";
import { reloadSidebar } from "@/contentScript/messenger/api";

interface State {
  hasError: boolean;
  errorMessage: string;
  stack: string;
}

class ErrorBoundary extends Component<UnknownObject, State> {
  constructor(props: UnknownObject) {
    super(props);
    this.state = { hasError: false, errorMessage: undefined, stack: undefined };
  }

  static getDerivedStateFromError(error: Error) {
    // Update state so the next render will show the fallback UI.
    return {
      hasError: true,
      errorMessage: getErrorMessage(error),
      stack: error.stack,
    };
  }

  override componentDidCatch(error: Error): void {
    if (isExtensionContext()) {
      reportError(error);
    }
  }

  async reloadSidebar() {
    const sidebar = await whoAmI();
    await reloadSidebar({ tabId: sidebar.tab.id });
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-3">
          <Alert variant="danger">
            <Alert.Heading>Something went wrong</Alert.Heading>
            {!isEmpty(this.state.errorMessage) && (
              <>
                <p>{this.state.errorMessage}</p>
              </>
            )}

            <p>Please close and re-open the sidebar panel.</p>

            <div>
              <Button variant="light" onClick={this.reloadSidebar}>
                <FontAwesomeIcon icon={faRedo} /> Reload Sidebar
              </Button>
            </div>
          </Alert>

          {this.state.stack && (
            <pre className="mt-2 small text-secondary">
              {this.state.stack
                // In the app
                .replaceAll(location.origin + "/", "")
                // In the content script
                .replaceAll(
                  `chrome-extension://${process.env.CHROME_EXTENSION_ID}/`,
                  ""
                )}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
