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

import { type Logger, type SanitizedServiceConfiguration } from "@/core";
import { type Option } from "@/components/form/widgets/SelectWidget";
import { proxyService } from "@/background/messenger/api";
import {
  type Activity,
  type Bot,
  BOT_TYPE,
  type DeployResponse,
  type Device,
  type DevicePool,
  type Execution,
  FAILURE_STATUSES,
  type Folder,
  type Interface,
  type ListResponse,
  type RunAsUser,
  type WorkspaceType,
} from "@/contrib/automationanywhere/contract";
import { cachePromiseMethod } from "@/utils/cachePromise";
import {
  interfaceToInputSchema,
  mapBotInput,
  selectBotOutput,
} from "@/contrib/automationanywhere/aaUtils";
import { isNullOrBlank, pollUntilTruthy, sleep } from "@/utils";
import {
  type CommunityBotArgs,
  type EnterpriseBotArgs,
} from "@/contrib/automationanywhere/aaTypes";
import { BusinessError } from "@/errors/businessErrors";
import { castArray, cloneDeep, isEmpty, sortBy } from "lodash";
import { type AxiosRequestConfig } from "axios";

// https://docs.automationanywhere.com/bundle/enterprise-v2019/page/enterprise-cloud/topics/control-room/control-room-api/cloud-api-filter-request.html
// Same as default for Control Room
const PAGINATION_LIMIT = 100;

export const DEFAULT_MAX_WAIT_MILLIS = 60_000;
const POLL_MILLIS = 2000;

const SORT_BY_NAME = {
  sort: [
    {
      field: "name",
      direction: "asc",
    },
  ],
};

/**
 * Fetch paginated Control Room responses.
 * @param config the control room integration configuration
 * @param requestConfig the axios configuration for the request
 * @param maxPages maximum number of pages to fetch, defaults to all pages
 */
async function fetchPages<TData>(
  config: SanitizedServiceConfiguration,
  requestConfig: AxiosRequestConfig,
  { maxPages = Number.MAX_SAFE_INTEGER }: { maxPages?: number } = {}
): Promise<TData[]> {
  // https://docs.automationanywhere.com/bundle/enterprise-v2019/page/enterprise-cloud/topics/control-room/control-room-api/cloud-api-filter-request.html

  if (requestConfig.data.page) {
    throw new Error("pagination parameter already set on request config");
  }

  const paginatedRequestConfig = cloneDeep(requestConfig);
  paginatedRequestConfig.data.page = {
    offset: 0,
    length: PAGINATION_LIMIT,
  };

  const initialResponse = await proxyService<ListResponse<TData>>(
    config,
    paginatedRequestConfig
  );

  if (initialResponse.data.list == null) {
    // Use TypeError instead of BusinessError to ensure we get the telemetry in Rollbar if we're calling API incorrectly
    throw new TypeError("Expected list response from Control Room");
  }

  const results: TData[] = [...initialResponse.data.list];
  const total = initialResponse.data.page.totalFilter;

  // Note that CR API uses offset/length instead of page/size
  let page = 0;
  let offset = results.length;
  while (offset < total && page < maxPages) {
    paginatedRequestConfig.data.page = {
      offset,
      length: PAGINATION_LIMIT,
    };
    // eslint-disable-next-line no-await-in-loop -- be conservative on number of concurrent requests to CR
    const response = await proxyService<ListResponse<TData>>(
      config,
      paginatedRequestConfig
    );
    results.push(...response.data.list);
    offset += response.data.list.length;
    page += 1;
  }

  return results;
}

/**
 * Return information about a bot in a Control Room.
 */
async function fetchBotFile(
  config: SanitizedServiceConfiguration,
  fileId: string
): Promise<Bot> {
  // The same API endpoint can be used for any file, but for now assume it's a bot
  const response = await proxyService<Bot>(config, {
    url: `/v2/repository/files/${fileId}`,
    method: "GET",
  });
  return response.data;
}

export const cachedFetchBotFile = cachePromiseMethod(
  ["aa:fetchBotFile"],
  fetchBotFile
);

/**
 * Return information about a bot in a Control Room.
 */
async function fetchFolder(
  config: SanitizedServiceConfiguration,
  folderId: string
): Promise<Folder> {
  // The same API endpoint can be used for any file, but for now assume it's a bot
  const response = await proxyService<Folder>(config, {
    url: `/v2/repository/files/${folderId}`,
    method: "GET",
  });
  return response.data;
}

export const cachedFetchFolder = cachePromiseMethod(
  ["aa:fetchFolder"],
  fetchFolder
);

async function searchBots(
  config: SanitizedServiceConfiguration,
  options: { workspaceType: WorkspaceType; query: string; value: string | null }
): Promise<Option[]> {
  if (isNullOrBlank(options.workspaceType)) {
    throw new TypeError("workspaceType is required");
  }

  let searchPayload = {
    ...SORT_BY_NAME,
    filter: {
      operator: "and",
      operands: [
        {
          operator: "substring",
          field: "name",
          value: options.query ?? "",
        },
        {
          operator: "eq",
          field: "type",
          value: BOT_TYPE,
        },
      ],
    },
  };

  if (isNullOrBlank(options.query) && !isNullOrBlank(options.value)) {
    // If the value is set, but not the query just return the result set for the current value to ensure we can show
    // the label for the value. Ideally we'd show the value + a page of results to allow easily switching the value
    // but that would require an extra request unless the sort could somehow put the known value first
    searchPayload = {
      ...SORT_BY_NAME,
      filter: {
        operator: "and",
        operands: [
          {
            operator: "eq",
            field: "id",
            value: options.value,
          },
          {
            operator: "eq",
            field: "type",
            value: BOT_TYPE,
          },
        ],
      },
    };
  }

  let bots: Bot[];

  // The folderId field on the integration is now deprecated. See BotOptions for the alert shown to user if
  // the Page Editor configuration is only showing bots for the folder id.
  if (isEmpty(config.config.folderId)) {
    bots = await fetchPages<Bot>(
      config,
      {
        url: `/v2/repository/workspaces/${options.workspaceType}/files/list`,
        method: "POST",
        data: searchPayload,
      },
      { maxPages: 1 }
    );
  } else {
    // The /folders/:id/list endpoint works on both community and Enterprise. The /v2/repository/file/list doesn't
    // include `type` field for filters or in the body or the response
    bots = await fetchPages<Bot>(
      config,
      {
        url: `/v2/repository/folders/${config.config.folderId}/list`,
        method: "POST",
        data: searchPayload,
      },
      { maxPages: 1 }
    );
  }

  return bots.map((bot) => ({
    value: bot.id,
    label: bot.name,
  }));
}

export const cachedSearchBots = cachePromiseMethod(
  ["aa:fetchBots"],
  searchBots
);

async function fetchDevices(
  config: SanitizedServiceConfiguration
): Promise<Option[]> {
  const devices = await fetchPages<Device>(config, {
    url: "/v2/devices/list",
    method: "POST",
    data: {},
  });

  const selectLabel = (device: Device) =>
    device.nickname
      ? `${device.nickname} (${device.hostName})`
      : device.hostName;

  return sortBy(
    devices.map((device) => ({
      value: device.id,
      label: selectLabel(device),
    })),
    (option) => option.label
  );
}

export const cachedFetchDevices = cachePromiseMethod(
  ["aa:fetchDevices"],
  fetchDevices
);

async function fetchDevicePools(
  config: SanitizedServiceConfiguration
): Promise<Option[]> {
  const devicePools = await fetchPages<DevicePool>(config, {
    url: "/v2/devices/pools/list",
    method: "POST",
    data: { ...SORT_BY_NAME },
  });
  return devicePools.map((pool) => ({
    value: pool.id,
    label: pool.name,
  }));
}

export const cachedFetchDevicePools = cachePromiseMethod(
  ["aa:fetchDevicePools"],
  fetchDevicePools
);

async function fetchRunAsUsers(
  config: SanitizedServiceConfiguration
): Promise<Option[]> {
  const users = await fetchPages<RunAsUser>(config, {
    url: "/v1/devices/runasusers/list",
    method: "POST",
    data: {},
  });
  return sortBy(users, (user) => user.username).map((user) => ({
    value: user.id,
    label: user.username,
  }));
}

export const cachedFetchRunAsUsers = cachePromiseMethod(
  ["aa:fetchRunAsUsers"],
  fetchRunAsUsers
);

async function fetchSchema(
  config: SanitizedServiceConfiguration,
  fileId: string
) {
  if (config && fileId) {
    const response = await proxyService<Interface>(config, {
      url: `/v1/filecontent/${fileId}/interface`,
      method: "GET",
    });

    return interfaceToInputSchema(response.data);
  }
}

export const cachedFetchSchema = cachePromiseMethod(
  ["aa:fetchSchema"],
  fetchSchema
);

export async function runCommunityBot({
  service,
  fileId,
  data,
  deviceId,
}: CommunityBotArgs): Promise<void> {
  // Don't bother returning the DeployResponse because it's just "0" for all community deployments
  // https://docs.automationanywhere.com/bundle/enterprise-v11.3/page/enterprise/topics/control-room/control-room-api/orchestrator-bot-deploy.html
  await proxyService<DeployResponse>(service, {
    url: "/v2/automations/deploy",
    method: "post",
    data: {
      fileId,
      botInput: mapBotInput(data),
      currentUserDeviceId: deviceId,
      scheduleType: "INSTANT",
    },
  });
}

export async function runEnterpriseBot({
  service,
  fileId,
  data,
  runAsUserIds = [],
  poolIds = [],
}: EnterpriseBotArgs) {
  // https://docs.automationanywhere.com/bundle/enterprise-v2019/page/enterprise-cloud/topics/control-room/control-room-api/cloud-bot-deploy-task.html
  const { data: deployData } = await proxyService<DeployResponse>(service, {
    url: "/v3/automations/deploy",
    method: "post",
    data: {
      fileId,
      botInput: mapBotInput(data),
      // Use the runAsUser's default device instead of a device pool
      overrideDefaultDevice: poolIds?.length > 0,
      numOfRunAsUsersToUse: 1,
      poolIds,
      runAsUserIds: castArray(runAsUserIds),
    },
  });

  return deployData;
}

export async function pollEnterpriseResult({
  service,
  deploymentId,
  logger,
  maxWaitMillis = DEFAULT_MAX_WAIT_MILLIS,
}: {
  service: SanitizedServiceConfiguration;
  deploymentId: string;
  logger: Logger;
  maxWaitMillis?: number;
}) {
  const poll = async () => {
    // Sleep first because it's unlikely it will be completed immediately after the running the bot
    await sleep(POLL_MILLIS);

    // https://docs.automationanywhere.com/bundle/enterprise-v11.3/page/enterprise/topics/control-room/control-room-api/orchestrator-bot-progress.html
    const { data: activityList } = await proxyService<ListResponse<Activity>>(
      service,
      {
        url: "/v3/activity/list",
        method: "post",
        data: {
          filter: {
            operator: "eq",
            field: "deploymentId",
            value: deploymentId,
          },
        },
      }
    );

    if (activityList.list.length > 1) {
      logger.error(
        `Multiple activities found for deployment: ${deploymentId}`,
        {
          deploymentId,
          activities: activityList.list,
        }
      );
      throw new BusinessError(
        "Multiple activity instances found for automation"
      );
    }

    if (activityList.list.length === 0) {
      logger.error(`Activity not found for deployment: ${deploymentId}`, {
        deploymentId,
      });
      throw new BusinessError("Activity not found for deployment");
    }

    const activity = activityList.list[0];

    if (activity.status === "COMPLETED") {
      return activity;
    }

    if (FAILURE_STATUSES.has(activity.status)) {
      logger.error(`Automation Anywhere run failed: ${deploymentId}`, {
        activity,
      });
      throw new BusinessError("Automation Anywhere run failed");
    }
  };

  const completedActivity = await pollUntilTruthy(poll, {
    intervalMillis: 0, // Already covered by the inline `sleep`
    maxWaitMillis,
  });

  if (completedActivity) {
    const { data: execution } = await proxyService<Execution>(service, {
      url: `/v3/activity/execution/${completedActivity.id}`,
      method: "get",
    });

    return selectBotOutput(execution);
  }

  throw new BusinessError(
    `Bot did not finish in ${Math.round(maxWaitMillis / 1000)} seconds`
  );
}
