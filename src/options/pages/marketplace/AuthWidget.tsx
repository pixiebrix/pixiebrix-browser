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

import React, { useCallback, useMemo, useState } from "react";
import ServiceAuthSelector from "@/components/ServiceAuthSelector";
import { type AuthOption } from "@/auth/authTypes";
import { useField } from "formik";
import { useDispatch } from "react-redux";
import { useAsyncState } from "@/hooks/common";
import registry from "@/services/registry";
import {
  type RawServiceConfiguration,
  type RegistryId,
  type UUID,
} from "@/core";
import { uuidv4 } from "@/types/helpers";
import { persistor } from "@/store/optionsStore";
import { services } from "@/background/messenger/api";
import { Button } from "react-bootstrap";
import ServiceEditorModal from "@/options/pages/services/ServiceEditorModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faSync } from "@fortawesome/free-solid-svg-icons";
import servicesSlice from "@/store/servicesSlice";
import notify from "@/utils/notify";
import createMenuListWithAddButton from "@/components/form/widgets/createMenuListWithAddButton";
import useAuthorizationGrantFlow from "@/hooks/useAuthorizationGrantFlow";
import styles from "./AuthWidget.module.scss";

const { updateServiceConfig } = servicesSlice.actions;

const AuthWidget: React.FunctionComponent<{
  /**
   * The field name. WARNING: do not use `serviceId`s as part of a field name because they can contain periods which
   * break Formik's nested field naming.
   */
  name: string;

  serviceId: RegistryId;

  authOptions: AuthOption[];

  /**
   * Optional callback to refresh the authOptions.
   */
  onRefresh?: () => void;
}> = ({ name, serviceId, authOptions, onRefresh }) => {
  const helpers = useField<UUID>(name)[2];
  const dispatch = useDispatch();

  const [showServiceModal, setShowServiceModal] = useState(false);

  const [serviceDefinition, isPending, error] = useAsyncState(async () => {
    const serviceDefinitions = await registry.all();
    return serviceDefinitions.find((x) => x.id === serviceId);
  }, [serviceId]);

  const options = useMemo(
    () => authOptions.filter((x) => x.serviceId === serviceId),
    [authOptions, serviceId]
  );

  const refreshAuthOptions = () => {
    // `onRefresh` is not awaitable. Indicate that clicking the button did something
    notify.info("Refreshing integration configurations");
    onRefresh();
  };

  const save = useCallback(
    async (values: RawServiceConfiguration) => {
      const id = uuidv4();

      dispatch(
        updateServiceConfig({
          ...values,
          serviceId,
          id,
        })
      );

      // Need to write the current Redux options to storage so the locator can read them during checks
      await persistor.flush();

      // Also refresh the service locator on the background so the new auth works immediately
      await services.refresh({ remote: false, local: true });

      if (onRefresh) {
        onRefresh();
      }

      notify.success("Added configuration for integration");

      // Don't need to track changes locally via setCreated; the new auth automatically flows
      // through via the redux selectors

      helpers.setValue(id);

      setShowServiceModal(false);
    },
    [helpers, dispatch, setShowServiceModal, serviceId, onRefresh]
  );

  const launchAuthorizationGrantFlow = useAuthorizationGrantFlow();

  const CustomMenuList = useMemo(
    () =>
      createMenuListWithAddButton(async () => {
        if (serviceDefinition.isAuthorizationGrant) {
          void launchAuthorizationGrantFlow(serviceDefinition, {
            target: "_self",
          });
          return;
        }

        setShowServiceModal(true);
      }),
    [setShowServiceModal, launchAuthorizationGrantFlow, serviceDefinition]
  );

  const initialConfiguration: RawServiceConfiguration = useMemo(
    () =>
      ({
        serviceId,
        label: "New Configuration",
        config: {},
      } as RawServiceConfiguration),
    [serviceId]
  );

  return (
    <>
      {showServiceModal && (
        <ServiceEditorModal
          configuration={initialConfiguration}
          service={serviceDefinition}
          onClose={() => {
            setShowServiceModal(false);
          }}
          onSave={save}
        />
      )}

      <div className="d-inline-flex justify-content-end">
        {options.length > 0 ? (
          <>
            <div className={styles.selector}>
              <ServiceAuthSelector
                name={name}
                serviceId={serviceId}
                authOptions={options}
                CustomMenuList={CustomMenuList}
              />
            </div>
            {onRefresh && (
              <div>
                <Button
                  size="sm"
                  variant="info"
                  className={styles.actionButton}
                  onClick={refreshAuthOptions}
                  title="Refresh integration configurations"
                >
                  <FontAwesomeIcon icon={faSync} />
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <Button
              variant="info"
              size="sm"
              className={styles.actionButton}
              onClick={() => {
                if (serviceDefinition.isAuthorizationGrant) {
                  void launchAuthorizationGrantFlow(serviceDefinition, {
                    target: "_self",
                  });
                  return;
                }

                setShowServiceModal(true);
              }}
              disabled={isPending || error != null}
            >
              <FontAwesomeIcon icon={faPlus} /> Configure
            </Button>

            {onRefresh && (
              <Button
                size="sm"
                variant="info"
                className={styles.actionButton}
                onClick={refreshAuthOptions}
                title="Refresh integration configurations"
              >
                <FontAwesomeIcon icon={faSync} /> Refresh
              </Button>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default AuthWidget;
