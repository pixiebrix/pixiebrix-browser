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

import React, { useCallback, useState } from "react";
import { Button, Tab, Table } from "react-bootstrap";
import { FieldArray, useField } from "formik";
import { ServiceDependency } from "@/core";
import DependencyRow from "./DependencyRow";
import { head } from "lodash";
import { ServiceDefinition } from "@/types/definitions";
import ServiceModal from "@/components/fields/ServiceModal";
import { PACKAGE_REGEX } from "@/types/helpers";
import useFetch from "@/hooks/useFetch";
import AsyncButton from "@/components/AsyncButton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCloud, faPlus, faSync } from "@fortawesome/free-solid-svg-icons";
import { browser } from "webextension-polyfill-ts";
import { useToasts } from "react-toast-notifications";

import "./ServicesTab.scss";
import { useAuthOptions } from "@/hooks/auth";

function defaultOutputKey(serviceId: string): string {
  const match = PACKAGE_REGEX.exec(serviceId);
  return match.groups.collection?.replace(".", "_").replace("-", "_") ?? "";
}

const ServicesTab: React.FunctionComponent<{
  name?: string;
  eventKey?: string;
}> = ({ name = "services", eventKey = "services" }) => {
  const { addToast } = useToasts();
  const [field, meta] = useField(name);
  const [selectKey, setKey] = useState(0);

  const [authOptions, refreshAuths] = useAuthOptions();
  const { data: services, refresh: refreshServices } = useFetch<
    ServiceDefinition[]
  >("/api/services/");

  const refresh = useCallback(
    async () => Promise.all([refreshServices(), refreshAuths()]),
    [refreshAuths, refreshServices]
  );

  return (
    <Tab.Pane eventKey={eventKey} className="h-100">
      <p>
        Add integrations to re-use external accounts, resources, and APIs that
        you or your team have configured.
      </p>

      <FieldArray name={name}>
        {({ push, remove }) => (
          <div>
            <div className="d-flex">
              <div>
                <ServiceModal
                  key={selectKey}
                  caption="Add Integration"
                  services={services}
                  renderButton={({ setShow }) => (
                    <Button
                      variant="primary"
                      onClick={() => {
                        setShow(true);
                      }}
                    >
                      <FontAwesomeIcon icon={faPlus} /> Add Integration
                    </Button>
                  )}
                  onSelect={(x) => {
                    push({
                      id: x.metadata.id,
                      outputKey: defaultOutputKey(x.metadata.id),
                      config: head(
                        authOptions.filter(
                          (option) =>
                            option.local && option.serviceId === x.metadata.id
                        )
                      )?.value,
                    });
                    // Reset value in dropdown
                    setKey((k) => k + 1);
                  }}
                />
              </div>
              {/* spacer */}
              <div className="flex-grow-1" />
              <div>
                <Button
                  variant="link"
                  onClick={async () => {
                    const baseUrl = browser.runtime.getURL("options.html");
                    const url = `${baseUrl}#/services`;
                    await browser.tabs.create({ url, active: true });
                  }}
                >
                  <FontAwesomeIcon icon={faCloud} /> Open Services Page
                </Button>
                <AsyncButton
                  onClick={async () => {
                    await refresh();
                    addToast("Refreshed available integration configurations", {
                      appearance: "success",
                      autoDismiss: true,
                    });
                  }}
                  variant="info"
                >
                  <FontAwesomeIcon icon={faSync} /> Refresh Available
                </AsyncButton>
              </div>
            </div>
            {typeof meta.error === "string" && <span>{meta.error}</span>}
            <Table className="ServicesTable">
              <thead>
                <tr>
                  <th style={{ width: 250 }}>Key</th>
                  <th>Type</th>
                  <th style={{ width: 350 }}>Service</th>
                  <th>&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {(field.value ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4}>No integrations added yet</td>
                  </tr>
                )}

                {(field.value ?? []).map(
                  (dependency: ServiceDependency, index: number) => (
                    <DependencyRow
                      key={index}
                      field={field}
                      authOptions={authOptions}
                      dependency={dependency}
                      index={index}
                      remove={remove}
                    />
                  )
                )}
              </tbody>
            </Table>
          </div>
        )}
      </FieldArray>
    </Tab.Pane>
  );
};

export default ServicesTab;
