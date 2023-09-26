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

import { useField } from "formik";
import useSanitizedIntegrationConfigFormikAdapter from "@/services/useSanitizedIntegrationConfigFormikAdapter";
import { UIPATH_SERVICE_IDS } from "@/contrib/uipath/process";
import { useMemo } from "react";
import { useAsyncState } from "@/hooks/common";
import { releaseSchema } from "@/contrib/uipath/typeUtils";
import { optionalFactory } from "@/contrib/remoteOptionUtils";
import { type Option } from "@/components/form/widgets/SelectWidget";
import {
  type ODataResponseData,
  type Release,
} from "@/contrib/uipath/uipathContract";
import { type SanitizedIntegrationConfig } from "@/types/integrationTypes";
import { performConfiguredRequestInBackground } from "@/background/messenger/api";
import cachePromise from "@/utils/cachePromise";

const optionalFetchReleases = optionalFactory(fetchReleases);

type ReleaseOption = Option & { data: Release };

async function fetchReleases(
  config: SanitizedIntegrationConfig
): Promise<ReleaseOption[]> {
  const response = await performConfiguredRequestInBackground<
    ODataResponseData<Release>
  >(config, {
    url: "/odata/Releases",
    method: "get",
  });
  const releases = response.data.value;
  return releases.map((x) => ({
    value: x.Key,
    label: `${x.Name} - ${x.ProcessVersion}`,
    data: x,
  }));
}

export function useSelectedRelease(releaseKeyFieldName: string) {
  const [{ value: releaseKey }] = useField<string>(releaseKeyFieldName);

  const { data: sanitizedConfig } =
    useSanitizedIntegrationConfigFormikAdapter(UIPATH_SERVICE_IDS);

  const releasesPromise = useMemo(
    async () =>
      cachePromise(["uipath:useSelectedRelease", sanitizedConfig], async () =>
        optionalFetchReleases(sanitizedConfig)
      ),
    [sanitizedConfig]
  );

  const [selectedRelease] = useAsyncState(async () => {
    const options = await releasesPromise;
    const { data: release } = (options as ReleaseOption[]).find(
      (option) => option.data.Key === releaseKey
    );
    const schema = release ? releaseSchema(release) : null;
    return {
      release,
      schema,
    };
  }, [releasesPromise, releaseKey]);

  return {
    selectedRelease,
    releasesPromise,
  };
}
