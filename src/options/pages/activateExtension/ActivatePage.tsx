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

import { faCloudDownloadAlt } from "@fortawesome/free-solid-svg-icons";
import React from "react";
import { useParams } from "react-router";
import { Col, Row } from "react-bootstrap";
import ErrorBoundary from "@/components/ErrorBoundary";
import useFetch from "@/hooks/useFetch";
import { CloudExtension } from "@/types/contract";
import Page from "@/layout/Page";
import ActivateForm from "@/options/pages/activateExtension/ActivateForm";
import { useAuthOptions } from "@/hooks/auth";

/**
 * Page for activating an extension that's stored in the cloud.
 */
const ActivatePage: React.FunctionComponent = () => {
  const { extensionId } = useParams<{ extensionId: string }>();

  const { data: extension, isLoading, error } = useFetch<CloudExtension>(
    `/api/extensions/${extensionId}`
  );

  const [authOptions] = useAuthOptions();

  return (
    <Page
      title={
        extension
          ? `Activate: ${extension.label ?? extension.id}`
          : "Activate Brick"
      }
      icon={faCloudDownloadAlt}
      description="Activate a personal brick from the cloud"
      error={error}
      isPending={isLoading || authOptions == null}
    >
      <Row>
        <Col xl={8} lg={10} md={12}>
          <ErrorBoundary>
            {extension && authOptions && (
              <ActivateForm extension={extension} authOptions={authOptions} />
            )}
          </ErrorBoundary>
        </Col>
      </Row>
    </Page>
  );
};

export default ActivatePage;
