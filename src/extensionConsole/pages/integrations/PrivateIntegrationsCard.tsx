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

import { useSelector } from "react-redux";
import { Button } from "react-bootstrap";
import React, { useCallback, useMemo } from "react";
import { type Column, type Row } from "react-table";
import { isEqual } from "lodash";
import PaginatedTable from "@/components/paginatedTable/PaginatedTable";
import { type RootState } from "@/store/optionsStore";
import { faEdit, faSignOutAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { deleteCachedAuthData } from "@/background/messenger/api";
import notify from "@/utils/notify";
import EllipsisMenu from "@/components/ellipsisMenu/EllipsisMenu";
import BrickIcon from "@/components/BrickIcon";
import {
  type Integration,
  type IntegrationConfig,
} from "@/types/integrationTypes";
import { type UUID } from "@/types/stringTypes";
import { selectIntegrationConfigs } from "@/store/integrations/integrationsSelectors";

type TableData = {
  integration: Integration;
} & IntegrationConfig;
type TableColumn = Column<TableData>;

type OwnProps = {
  integrations: Integration[];
  navigate: (url: string) => void;
  initialIntegration?: Integration;
};

const Actions: React.VoidFunctionComponent<{
  row: Row<TableData>;
  id: UUID;
  navigate: (url: string) => void;
  resetAuth: (authId: UUID) => Promise<void>;
}> = ({ row, id, navigate, resetAuth }) => {
  if (row.index === 0) {
    return (
      <Button
        style={{ width: 100 }}
        variant="info"
        size="sm"
        onClick={() => {
          navigate("/services/zapier/");
        }}
      >
        View Key
      </Button>
    );
  }

  return (
    <EllipsisMenu
      items={[
        {
          title: (
            <>
              <FontAwesomeIcon fixedWidth icon={faEdit} /> Configure
            </>
          ),
          action() {
            navigate(`/services/${encodeURIComponent(id)}`);
          },
        },
        {
          title: (
            <>
              <FontAwesomeIcon fixedWidth icon={faSignOutAlt} /> Reset Token
            </>
          ),
          action: async () => resetAuth(id),
          hide:
            !row.original.integration.isOAuth2 &&
            !row.original.integration.isToken,
        },
      ]}
    />
  );
};

const columnFactory = ({
  navigate,
  resetAuth,
}: {
  navigate: (url: string) => void;
  resetAuth: (authId: UUID) => Promise<void>;
}): TableColumn[] => [
  {
    Header: "Label",
    accessor: "label",
    Cell: ({ value }) => (
      <>
        {value ? (
          <span>{value}</span>
        ) : (
          <span className="text-muted">No label provided</span>
        )}
      </>
    ),
  },
  {
    Header: "Type",
    accessor: "integrationId",
    Cell({ row }) {
      if (row.index === 0) {
        return <div className="text-muted">N/A</div>;
      }

      return (
        <>
          <BrickIcon brick={row.original.integration} size="1x" />
          <div className="ml-2">
            <div className="text-wrap">{row.original.integration.name}</div>
            <div className="text-wrap">
              <code className="p-0" style={{ fontSize: "0.7rem" }}>
                {row.original.integration.id}
              </code>
            </div>
          </div>
        </>
      );
    },
  },
  {
    disableSortBy: true,
    Header: "Actions",
    accessor: "id",
    width: 100,
    Cell({ row, value }) {
      return (
        <Actions
          row={row}
          id={value}
          navigate={navigate}
          resetAuth={resetAuth}
        />
      );
    },
  },
];

const dataFactory = ({
  integrationConfigs,
  integrations,
}: {
  integrationConfigs: IntegrationConfig[];
  integrations: Integration[];
}): TableData[] => [
  {
    label: "Zapier - use to connect to PixieBrix from Zapier",
    integrationId: null,
    _rawIntegrationConfigBrand: null,
    id: null,
    config: null,
    integration: null,
  },
  ...integrationConfigs.map((integrationConfig) => {
    const integration = integrations.find(
      (x) => x.id === integrationConfig.integrationId
    );
    if (!integration) {
      throw new Error(`Unknown integration ${integrationConfig.integrationId}`);
    }

    return {
      integration,
      ...integrationConfig,
    };
  }),
];

const PrivateIntegrationsCard: React.FunctionComponent<OwnProps> = ({
  integrations,
  navigate,
  initialIntegration,
}) => {
  const integrationConfigs = useSelector<RootState, IntegrationConfig[]>(
    selectIntegrationConfigs,
    isEqual
  );

  const resetAuth = useCallback(async (authId: UUID) => {
    try {
      await deleteCachedAuthData(authId);
      notify.success("Reset login for integration");
    } catch (error) {
      notify.error({ message: "Error resetting login for integration", error });
    }
  }, []);
  const columns = useMemo(
    () => columnFactory({ navigate, resetAuth }),
    [navigate, resetAuth]
  );
  const data = useMemo(
    () => dataFactory({ integrationConfigs, integrations }),
    [integrationConfigs, integrations]
  );

  const initialRecord: (x: unknown) => boolean = useMemo(
    () =>
      initialIntegration
        ? (x: Integration) => x.id === initialIntegration.id
        : null,
    [initialIntegration]
  );

  return (
    <>
      <PaginatedTable
        columns={columns}
        data={data}
        showSearchFilter
        initialRecord={initialRecord}
      />
    </>
  );
};

export default PrivateIntegrationsCard;
