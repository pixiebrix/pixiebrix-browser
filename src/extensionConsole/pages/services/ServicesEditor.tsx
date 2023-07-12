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

import styles from "@/extensionConsole/pages/services/PrivateServicesCard.module.scss";

import React, { useCallback, useContext, useState } from "react";
import { connect } from "react-redux";
import servicesSlice from "@/store/servicesSlice";
import Page from "@/layout/Page";
import { Card, Col, Row } from "react-bootstrap";
import { push } from "connected-react-router";
import ServiceEditorModal from "./ServiceEditorModal";
import PrivateServicesCard from "./PrivateServicesCard";
import ConnectExtensionCard from "./ConnectExtensionCard";
import { faCloud, faPlus } from "@fortawesome/free-solid-svg-icons";
import useServiceDefinitions from "./useServiceDefinitions";
import { services } from "@/background/messenger/api";
import ZapierModal from "@/extensionConsole/pages/services/ZapierModal";
import notify from "@/utils/notify";
import { useParams } from "react-router";
import BrickModal from "@/components/brickModalNoTags/BrickModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { uuidv4 } from "@/types/helpers";
import useAuthorizationGrantFlow from "@/hooks/useAuthorizationGrantFlow";
import { reportEvent } from "@/telemetry/events";
import { type Integration, type IntegrationConfig } from "@/types/serviceTypes";
import { type UUID } from "@/types/stringTypes";
import ReduxPersistenceContext from "@/store/ReduxPersistenceContext";

const { updateServiceConfig, deleteServiceConfig } = servicesSlice.actions;

type OwnProps = {
  updateServiceConfig: typeof updateServiceConfig;
  deleteServiceConfig: typeof deleteServiceConfig;
  navigate: typeof push;
};

const ServicesEditor: React.FunctionComponent<OwnProps> = ({
  updateServiceConfig,
  deleteServiceConfig,
  navigate,
}) => {
  const { id: configurationId } = useParams<{ id: UUID }>();
  // Newly created integration (to ensure it's visible in the table)
  const [newIntegration, setNewIntegration] = useState<Integration | null>(
    null
  );
  const [newConfigurationService, setNewConfigurationService] =
    useState<Integration>(null);
  const [newConfiguration, setNewConfiguration] =
    useState<IntegrationConfig>(null);
  const { flush: flushReduxPersistence } = useContext(ReduxPersistenceContext);

  const {
    activeConfiguration,
    serviceDefinitions,
    activeService,
    showZapier,
    isPending: servicesPending,
  } = useServiceDefinitions();

  const isConfiguring =
    configurationId &&
    ((newConfigurationService && newConfiguration) ||
      (activeService && activeConfiguration));

  const handleSave = useCallback(
    async (config) => {
      updateServiceConfig(config);
      notify.success(
        `${
          newConfigurationService ? "Created" : "Updated"
        } private configuration for ${
          (activeService ?? newConfigurationService)?.name
        }.`
      );

      setNewConfiguration(null);
      setNewConfigurationService(null);
      setNewIntegration(config as Integration);
      await flushReduxPersistence();

      try {
        await services.refresh();
      } catch (error) {
        notify.error({
          message:
            "Error refreshing service configurations, restart the PixieBrix extension",
          error,
        });
      }

      navigate("/services");
    },
    [
      updateServiceConfig,
      newConfigurationService,
      activeService,
      flushReduxPersistence,
      navigate,
    ]
  );

  const launchAuthorizationGrantFlow = useAuthorizationGrantFlow();

  const handleCreate = useCallback(
    async (service: Integration) => {
      reportEvent("ServiceAdd", {
        serviceId: service.id,
      });

      const definition = (serviceDefinitions ?? []).find(
        (x) => x.id === service.id
      );

      if (definition.isAuthorizationGrant) {
        void launchAuthorizationGrantFlow(service, { target: "_self" });
        return;
      }

      const config = {
        id: uuidv4(),
        label: undefined,
        serviceId: service.id,
        config: {},
      } as IntegrationConfig;

      setNewConfiguration(config);
      setNewConfigurationService(definition);
      navigate(`/services/${encodeURIComponent(config.id)}`);
    },
    [
      navigate,
      launchAuthorizationGrantFlow,
      serviceDefinitions,
      setNewConfiguration,
      setNewConfigurationService,
    ]
  );

  const handleDelete = useCallback(
    async (id) => {
      deleteServiceConfig({ id });
      notify.success(
        `Deleted private configuration for ${activeService?.name}`
      );
      navigate("/services/");

      await flushReduxPersistence();

      try {
        await services.refresh();
      } catch (error) {
        notify.error({
          message:
            "Error refreshing service configurations, restart the PixieBrix extension",
          error,
        });
      }
    },
    [deleteServiceConfig, activeService?.name, navigate, flushReduxPersistence]
  );

  return (
    <Page
      icon={faCloud}
      title="Integrations"
      description="Configure external accounts, resources, and APIs. Personal integrations are
          stored in your browser; they are never transmitted to the PixieBrix servers or shared with your team"
      isPending={servicesPending}
      toolbar={
        <BrickModal
          onSelect={handleCreate}
          bricks={serviceDefinitions}
          modalClassName={styles.ModalOverride}
          selectCaption={
            <span>
              <FontAwesomeIcon icon={faPlus} className="mr-1" /> Configure
            </span>
          }
          caption={
            <span>
              <FontAwesomeIcon icon={faPlus} />
              &nbsp;Add Integration
            </span>
          }
        />
      }
    >
      {showZapier && (
        <ZapierModal
          onClose={() => {
            navigate("/services");
          }}
        />
      )}
      {isConfiguring && (
        <ServiceEditorModal
          configuration={activeConfiguration ?? newConfiguration}
          service={activeService ?? newConfigurationService}
          onDelete={activeConfiguration && handleDelete}
          onClose={() => {
            navigate("/services");
          }}
          onSave={handleSave}
        />
      )}
      <Row>
        <Col>
          <ConnectExtensionCard />
        </Col>
      </Row>
      <Row>
        <Col>
          <Card>
            <Card.Header>Personal Integrations</Card.Header>
            <PrivateServicesCard
              navigate={navigate}
              services={serviceDefinitions}
              initialService={newIntegration}
            />
          </Card>
        </Col>
      </Row>
    </Page>
  );
};

export default connect(null, {
  updateServiceConfig,
  deleteServiceConfig,
  navigate: push,
})(ServicesEditor);
