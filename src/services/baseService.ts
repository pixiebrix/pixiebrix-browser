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

import isEmpty from "lodash/isEmpty";
import { isExtensionContext, readStorage, setStorage } from "@/chrome";
import useAsyncEffect from "use-async-effect";
import { useState, useCallback } from "react";

export const DEFAULT_SERVICE_URL = process.env.SERVICE_URL;
export const SERVICE_STORAGE_KEY = "service-url";

type ConfiguredHost = string | null | undefined;

function withoutTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export async function getBaseURL(): Promise<string> {
  if (isExtensionContext()) {
    const configured = (await readStorage(
      SERVICE_STORAGE_KEY
    )) as ConfiguredHost;
    return withoutTrailingSlash(
      isEmpty(configured) ? DEFAULT_SERVICE_URL : configured
    );
  }
  return withoutTrailingSlash(DEFAULT_SERVICE_URL);
}

export async function setBaseURL(serviceURL: string): Promise<void> {
  await setStorage(SERVICE_STORAGE_KEY, serviceURL);
}

type ConfiguredHostResult = [ConfiguredHost, (url: string) => Promise<void>];

/**
 * Hook for retrieving/setting the manually configured host.
 */
export function useConfiguredHost(): ConfiguredHostResult {
  const [state, setState] = useState<ConfiguredHost>();

  useAsyncEffect(
    async (isMounted) => {
      const configured = await readStorage<ConfiguredHost>(SERVICE_STORAGE_KEY);
      if (!isMounted()) return;
      setState(configured);
    },
    [setState]
  );

  const setUrl = useCallback(
    async (url) => {
      await setBaseURL(url);
      setState(url);
    },
    [setState]
  );

  return [isEmpty(state) ? undefined : state, setUrl];
}
