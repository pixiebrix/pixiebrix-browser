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

import { connect } from "react-redux";
import React, { useContext } from "react";
import { isEmpty } from "lodash";
import { optionsSlice } from "@/options/slices";
import Page from "@/layout/Page";
import { faCubes } from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";
import { Col, Row } from "react-bootstrap";
import { ExtensionRef, IExtension, UUID } from "@/core";
import "./InstalledPage.scss";
import { uninstallContextMenu } from "@/background/contextMenus";
import { reportError } from "@/telemetry/logging";
import AuthContext from "@/auth/AuthContext";
import { reportEvent } from "@/telemetry/events";
import { reactivate } from "@/background/navigation";
import { Dispatch } from "redux";
import { selectExtensions } from "@/options/selectors";
import NoExtensionsPage from "@/options/pages/installed/NoExtensionsPage";
import { OptionsState } from "@/store/extensions";
import { useAsyncState } from "@/hooks/common";
import { resolveDefinitions } from "@/registry/internal";
import { getLinkedApiClient } from "@/services/apiClient";
import { CloudExtension } from "@/types/contract";
import { RemoveAction } from "@/options/pages/installed/installedPageTypes";
import ActiveBricksCard from "@/options/pages/installed/ActiveBricksCard";
import useNotifications from "@/hooks/useNotifications";
import { exportBlueprint } from "./exportBlueprint";

const { removeExtension } = optionsSlice.actions;

const InstalledPage: React.FunctionComponent<{
  extensions: IExtension[];
  onRemove: RemoveAction;
}> = ({ extensions, onRemove }) => {
  const { flags } = useContext(AuthContext);

  const [allExtensions] = useAsyncState(async () => {
    const lookup = new Set<UUID>(extensions.map((x) => x.id));
    const { data } = await (await getLinkedApiClient()).get<CloudExtension[]>(
      "/api/extensions/"
    );
    const cloudExtensions = data
      .filter((x) => !lookup.has(x.id))
      .map((x) => ({ ...x, active: false }));

    return [...extensions, ...cloudExtensions];
  }, [extensions]);

  const [resolved] = useAsyncState(
    async () =>
      Promise.all(
        allExtensions.map(async (extension) => resolveDefinitions(extension))
      ),
    [allExtensions]
  );

  const notify = useNotifications();

  const onExportBlueprint = (extensionIdToExport: UUID) => {
    const extension = extensions.find((e) => e.id === extensionIdToExport);

    if (extension === null) {
      notify.error(
        `Error exporting as blueprint: extension with id ${extensionIdToExport} not found.`
      );
      return;
    }

    exportBlueprint(extension);
  };

  return (
    <Page title="Active Bricks" icon={faCubes}>
      <Row>
        <Col>
          <div className="pb-4">
            {isEmpty(extensions) ? (
              <p>
                Once you&apos;ve activated templates or created your own bricks,
                you&apos;ll be able to manage them here
              </p>
            ) : (
              <p>
                Here&apos;s a list of bricks you currently have activated.{" "}
                {flags.includes("marketplace") ? (
                  <>
                    You can find more to activate in the{" "}
                    <Link to={"/marketplace"}>Marketplace</Link>
                  </>
                ) : (
                  <>
                    You can find more to activate on the{" "}
                    <Link to={"/templates"}>Templates</Link> page. Or, follow
                    the{" "}
                    <a
                      href="https://docs.pixiebrix.com/quick-start-guide"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Page Editor Quickstart Guide
                    </a>{" "}
                    to create your own
                  </>
                )}
              </p>
            )}
          </div>
        </Col>
      </Row>
      {isEmpty(extensions) ? (
        <NoExtensionsPage />
      ) : (
        <ActiveBricksCard
          extensions={resolved}
          onRemove={onRemove}
          onExportBlueprint={onExportBlueprint}
        />
      )}
    </Page>
  );
};

const mapStateToProps = (state: { options: OptionsState }) => ({
  extensions: selectExtensions(state),
});

const mapDispatchToProps = (dispatch: Dispatch) => ({
  // IntelliJ doesn't detect use in the props
  onRemove: (ref: ExtensionRef) => {
    reportEvent("ExtensionRemove", {
      extensionId: ref.extensionId,
    });
    // Remove from storage first so it doesn't get re-added in reactivate step below
    dispatch(removeExtension(ref));
    // XXX: also remove remove side panel panels that are already open?
    void uninstallContextMenu(ref).catch((error) => {
      reportError(error);
    });
    void reactivate().catch((error: unknown) => {
      console.warn("Error re-activating content scripts", { error });
    });
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(InstalledPage);
