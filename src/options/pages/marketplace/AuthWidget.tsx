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

import React, { ComponentType, useCallback, useMemo, useState } from "react";
import ServiceAuthSelector from "@/components/ServiceAuthSelector";
import { AuthOption } from "@/auth/authTypes";
import { useField } from "formik";
import { useDispatch } from "react-redux";
import { useAsyncState } from "@/hooks/common";
import registry from "@/services/registry";
import { RawServiceConfiguration, RegistryId, UUID } from "@/core";
import { uuidv4 } from "@/types/helpers";
import { persistor } from "@/options/store";
import { refresh as refreshBackgroundLocator } from "@/background/locator";
import { GroupTypeBase, MenuListComponentProps } from "react-select";
import { Button } from "react-bootstrap";
import ServiceEditorModal from "@/options/pages/services/ServiceEditorModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { servicesSlice } from "@/options/slices";
import useNotifications from "@/hooks/useNotifications";

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
  onRefresh?: () => Promise<void>;
}> = ({ name, serviceId, authOptions, onRefresh }) => {
  const helpers = useField<UUID>(name)[2];
  const dispatch = useDispatch();
  const notify = useNotifications();

  const [showModal, setShow] = useState(false);

  const [serviceDefinition, isPending, error] = useAsyncState(
    async () => (await registry.all()).find((x) => x.id === serviceId),
    [serviceId]
  );

  const options = useMemo(
    () => authOptions.filter((x) => x.serviceId === serviceId),
    [authOptions, serviceId]
  );

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
      await refreshBackgroundLocator({ remote: false, local: true });

      if (onRefresh) {
        await onRefresh();
      }

      notify.success("Added configuration for integration");

      // Don't need to track changes locally via setCreated; the new auth automatically flows
      // through via the redux selectors

      helpers.setValue(id);

      setShow(false);
    },
    [helpers, notify, dispatch, setShow, serviceId, onRefresh]
  );

  const CustomMenuList = useMemo(() => {
    const MenuListWithAddButton: ComponentType<
      MenuListComponentProps<AuthOption, boolean, GroupTypeBase<AuthOption>>
    > = ({ children }) => (
      <div>
        {children}
        <div className="text-center">
          <Button
            size="sm"
            variant="link"
            onClick={() => {
              setShow(true);
            }}
          >
            + Add new
          </Button>
        </div>
      </div>
    );
    return MenuListWithAddButton;
  }, [setShow]);

  const initialConfiguration: RawServiceConfiguration = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- inline nominal typing
      ({
        serviceId,
        label: "New Configuration",
        config: {},
      } as RawServiceConfiguration),
    [serviceId]
  );

  return (
    <>
      {showModal && (
        <ServiceEditorModal
          configuration={initialConfiguration}
          service={serviceDefinition}
          onClose={() => {
            setShow(false);
          }}
          onSave={save}
        />
      )}

      <div className="d-inline-flex">
        {options.length > 0 && (
          <div style={{ minWidth: "300px" }} className="mr-2">
            <ServiceAuthSelector
              name={name}
              serviceId={serviceId}
              authOptions={options}
              CustomMenuList={CustomMenuList}
            />
          </div>
        )}
        <div>
          {options.length === 0 && (
            <Button
              variant={options.length > 0 ? "info" : "primary"}
              size="sm"
              style={{ height: "36px", marginTop: "1px" }}
              onClick={() => {
                setShow(true);
              }}
              disabled={isPending || error != null}
            >
              <FontAwesomeIcon icon={faPlus} /> Configure
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

export default AuthWidget;
