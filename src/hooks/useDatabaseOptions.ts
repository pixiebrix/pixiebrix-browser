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

import { useGetDatabasesQuery, useGetOrganizationsQuery } from "@/services/api";
import useMergeAsyncState from "@/hooks/useMergeAsyncState";
import { type FetchableAsyncState } from "@/types/sliceTypes";
import { type Option } from "@/components/form/widgets/SelectWidget";
import { type Database, type Organization } from "@/types/contract";

function databasesToOptions(
  databases: Database[],
  organizations: Organization[]
): Option[] {
  return databases.map((database) => {
    const organization = organizations.find(
      (x) => x.id === database.organization_id
    );

    return {
      label: `${database.name} - ${organization?.name ?? "Private"}`,
      value: database.id,
    };
  });
}

/**
 * React Hook that returns a fetchable list of private and team database options.
 * @param refetchOnMount true to refetch available databases on mount (default: false)
 */
function useDatabaseOptions({
  refetchOnMount,
}: { refetchOnMount?: boolean } = {}): FetchableAsyncState<Option[]> {
  const databasesQueryState = useGetDatabasesQuery(undefined, {
    refetchOnMountOrArgChange: refetchOnMount,
  });

  const organizationsQueryState = useGetOrganizationsQuery(undefined, {
    refetchOnMountOrArgChange: refetchOnMount,
  });

  return useMergeAsyncState(
    databasesQueryState,
    organizationsQueryState,
    // Provide as module function so useMergeAsyncState can memoize it
    databasesToOptions
  );
}

export default useDatabaseOptions;
