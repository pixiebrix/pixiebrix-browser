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

import {
  checkExtensionUpdateRequired,
  findLocalDeploymentConfiguredIntegrationDependencies,
  isDeploymentActive,
  makeUpdatedFilter,
  mergeDeploymentIntegrationDependencies,
} from "./deploymentUtils";
import {
  uuidv4,
  validateRegistryId,
  validateSemVerString,
  validateTimestamp,
} from "@/types/helpers";
import {
  CONTROL_ROOM_OAUTH_INTEGRATION_ID,
  PIXIEBRIX_INTEGRATION_ID,
} from "@/services/constants";
import { type SanitizedIntegrationConfig } from "@/types/integrationTypes";
import { validateOutputKey } from "@/runtime/runtimeTypes";
import { modComponentFactory } from "@/testUtils/factories/modComponentFactories";
import {
  modComponentDefinitionFactory,
  defaultModDefinitionFactory,
} from "@/testUtils/factories/modDefinitionFactories";
import { sanitizedIntegrationConfigFactory } from "@/testUtils/factories/integrationFactories";
import {
  deploymentFactory,
  deploymentPackageFactory,
} from "@/testUtils/factories/deploymentFactories";
import { getIntegrationIds } from "@/utils/modDefinitionUtils";

describe("makeUpdatedFilter", () => {
  test.each([[{ restricted: true }, { restricted: false }]])(
    "unmatched deployment",
    ({ restricted }) => {
      const modComponents = [modComponentFactory()];

      const filter = makeUpdatedFilter(modComponents, { restricted });
      expect(filter(deploymentFactory())).toBeTrue();
    }
  );

  test.each([[{ restricted: true }, { restricted: false }]])(
    "matched up-to-date deployment",
    ({ restricted }) => {
      const deployment = deploymentFactory();

      const extensions = [
        modComponentFactory({
          _deployment: {
            id: deployment.id,
            timestamp: deployment.updated_at,
            active: true,
          },
        }),
      ];

      const filter = makeUpdatedFilter(extensions, { restricted });
      expect(filter(deployment)).toBeFalse();
    }
  );

  test.each([[{ restricted: true }, { restricted: false }]])(
    "matched stale deployment",
    ({ restricted }) => {
      const deployment = deploymentFactory();

      const extensions = [
        modComponentFactory({
          _deployment: {
            id: deployment.id,
            timestamp: "2020-10-07T12:52:16.189Z",
            active: true,
          },
        }),
      ];

      const filter = makeUpdatedFilter(extensions, { restricted });
      expect(filter(deployment)).toBeTrue();
    }
  );

  test("matched blueprint for restricted user", () => {
    const deployment = deploymentFactory();

    const extensions = [
      modComponentFactory({
        _deployment: undefined,
        _recipe: {
          ...deployment.package.config.metadata,
          updated_at: validateTimestamp(deployment.updated_at),
          // `sharing` doesn't impact the predicate. Pass an arbitrary value
          sharing: undefined,
        },
      }),
    ];

    const filter = makeUpdatedFilter(extensions, { restricted: true });
    expect(filter(deployment)).toBeTrue();
  });

  test("matched blueprint for unrestricted user / developer", () => {
    const deployment = deploymentFactory();

    const extensions = [
      modComponentFactory({
        _deployment: undefined,
        _recipe: {
          ...deployment.package.config.metadata,
          // The factory produces version "1.0.1"
          version: validateSemVerString("1.0.1"),
          updated_at: validateTimestamp(deployment.updated_at),
          // `sharing` doesn't impact the predicate. Pass an arbitrary value
          sharing: undefined,
        },
      }),
    ];

    const filter = makeUpdatedFilter(extensions, { restricted: false });
    expect(filter(deployment)).toBeFalse();
  });
});

describe("checkExtensionUpdateRequired", () => {
  test("no deployments", () => {
    expect(checkExtensionUpdateRequired([])).toBeFalse();
  });

  test("update required", () => {
    const deployment = deploymentFactory();
    (deployment.package.config.metadata.extensionVersion as any) = ">=99.99.99";

    expect(checkExtensionUpdateRequired([deployment])).toBeTrue();
  });

  test("update not required", () => {
    const deployment = deploymentFactory();
    (deployment.package.config.metadata.extensionVersion as any) = `>=${
      browser.runtime.getManifest().version
    }`;
    expect(checkExtensionUpdateRequired([deployment])).toBeFalse();
  });
});

describe("isDeploymentActive", () => {
  test("not a deployment", () => {
    expect(isDeploymentActive(modComponentFactory())).toBeTrue();
  });

  test("legacy deployment", () => {
    const deployment = deploymentFactory();

    const modComponent = modComponentFactory({
      _deployment: {
        id: deployment.id,
        timestamp: deployment.updated_at,
        // Legacy deployments don't have an `active` field
      },
    });

    expect(isDeploymentActive(modComponent)).toBeTrue();
  });

  test.each([[{ active: true }, { active: false }]])(
    "deployment",
    ({ active }) => {
      const deployment = deploymentFactory();

      const modComponent = modComponentFactory({
        _deployment: {
          id: deployment.id,
          timestamp: deployment.updated_at,
          active,
        },
      });

      expect(isDeploymentActive(modComponent)).toBe(active);
    }
  );
});

describe("extractRecipeServiceIds", () => {
  test("find unique service ids", async () => {
    const deployment = deploymentFactory({
      package: deploymentPackageFactory({
        config: defaultModDefinitionFactory({
          extensionPoints: [
            modComponentDefinitionFactory({
              services: {
                [validateOutputKey("foo")]: CONTROL_ROOM_OAUTH_INTEGRATION_ID,
                [validateOutputKey("bar")]: CONTROL_ROOM_OAUTH_INTEGRATION_ID,
              },
            }),
          ],
        }),
      }),
    });

    expect(getIntegrationIds(deployment.package.config)).toStrictEqual([
      CONTROL_ROOM_OAUTH_INTEGRATION_ID,
    ]);
  });
});

describe("findPersonalServiceConfigurations", () => {
  test("missing personal service", async () => {
    const deployment = deploymentFactory({
      package: deploymentPackageFactory({
        config: defaultModDefinitionFactory({
          extensionPoints: [
            modComponentDefinitionFactory({
              services: {
                [validateOutputKey("foo")]: CONTROL_ROOM_OAUTH_INTEGRATION_ID,
              },
            }),
          ],
        }),
      }),
    });

    const locator = async () => [] as SanitizedIntegrationConfig[];
    expect(
      await findLocalDeploymentConfiguredIntegrationDependencies(
        deployment,
        locator
      )
    ).toStrictEqual([
      {
        id: CONTROL_ROOM_OAUTH_INTEGRATION_ID,
        outputKey: "foo",
        isOptional: false,
        apiVersion: "v1",
        configs: [],
      },
    ]);
  });

  test("found personal service", async () => {
    const deployment = deploymentFactory({
      package: deploymentPackageFactory({
        config: defaultModDefinitionFactory({
          extensionPoints: [
            modComponentDefinitionFactory({
              services: {
                [validateOutputKey("foo")]: CONTROL_ROOM_OAUTH_INTEGRATION_ID,
              },
            }),
          ],
        }),
      }),
    });

    const auth = sanitizedIntegrationConfigFactory({
      serviceId: CONTROL_ROOM_OAUTH_INTEGRATION_ID,
    });

    const locator = async () => [auth];
    expect(
      await findLocalDeploymentConfiguredIntegrationDependencies(
        deployment,
        locator
      )
    ).toStrictEqual([
      {
        id: CONTROL_ROOM_OAUTH_INTEGRATION_ID,
        outputKey: "foo",
        isOptional: false,
        apiVersion: "v1",
        configs: [auth],
      },
    ]);
  });

  test("exclude bound services", async () => {
    const registryId = validateRegistryId("test/bound");

    const deployment = deploymentFactory({
      bindings: [{ auth: { id: uuidv4(), service_id: registryId } }],
      package: deploymentPackageFactory({
        config: defaultModDefinitionFactory({
          extensionPoints: [
            modComponentDefinitionFactory({
              services: {
                [validateOutputKey("foo")]: registryId,
              },
            }),
          ],
        }),
      }),
    });

    const auth = sanitizedIntegrationConfigFactory({
      serviceId: registryId,
    });

    const locator = async () => [auth];
    expect(
      await findLocalDeploymentConfiguredIntegrationDependencies(
        deployment,
        locator
      )
    ).toBeArrayOfSize(0);
  });

  test("exclude pixiebrix service", async () => {
    const deployment = deploymentFactory({
      package: deploymentPackageFactory({
        config: defaultModDefinitionFactory({
          extensionPoints: [
            modComponentDefinitionFactory({
              services: {
                [validateOutputKey("foo")]: PIXIEBRIX_INTEGRATION_ID,
              },
            }),
          ],
        }),
      }),
    });

    const auth = sanitizedIntegrationConfigFactory({
      serviceId: PIXIEBRIX_INTEGRATION_ID,
    });

    const locator = async () => [auth];
    expect(
      await findLocalDeploymentConfiguredIntegrationDependencies(
        deployment,
        locator
      )
    ).toBeArrayOfSize(0);
  });
});

describe("mergeDeploymentServiceConfigurations", () => {
  test("prefer bound services", async () => {
    const registryId = validateRegistryId("test/bound");
    const boundId = uuidv4();

    const deployment = deploymentFactory({
      bindings: [{ auth: { id: boundId, service_id: registryId } }],
      package: deploymentPackageFactory({
        config: defaultModDefinitionFactory({
          extensionPoints: [
            modComponentDefinitionFactory({
              services: {
                [validateOutputKey("foo")]: registryId,
              },
            }),
          ],
        }),
      }),
    });

    const auth = sanitizedIntegrationConfigFactory({
      serviceId: registryId,
    });

    const locator = async () => [auth];
    expect(
      await mergeDeploymentIntegrationDependencies(deployment, locator)
    ).toStrictEqual([
      {
        id: registryId,
        outputKey: "foo",
        config: boundId,
        isOptional: false,
        apiVersion: "v1",
      },
    ]);
  });

  test("take local service", async () => {
    const deployment = deploymentFactory({
      package: deploymentPackageFactory({
        config: defaultModDefinitionFactory({
          extensionPoints: [
            modComponentDefinitionFactory({
              services: {
                [validateOutputKey("foo")]: CONTROL_ROOM_OAUTH_INTEGRATION_ID,
              },
            }),
          ],
        }),
      }),
    });

    const auth = sanitizedIntegrationConfigFactory({
      serviceId: CONTROL_ROOM_OAUTH_INTEGRATION_ID,
    });

    const locator = async () => [auth];
    expect(
      await mergeDeploymentIntegrationDependencies(deployment, locator)
    ).toStrictEqual([
      {
        id: CONTROL_ROOM_OAUTH_INTEGRATION_ID,
        outputKey: "foo",
        config: auth.id,
        isOptional: false,
        apiVersion: "v1",
      },
    ]);
  });

  test("ignore personal remote service", async () => {
    const deployment = deploymentFactory({
      package: deploymentPackageFactory({
        config: defaultModDefinitionFactory({
          extensionPoints: [
            modComponentDefinitionFactory({
              services: {
                [validateOutputKey("foo")]: CONTROL_ROOM_OAUTH_INTEGRATION_ID,
              },
            }),
          ],
        }),
      }),
    });

    const auth = sanitizedIntegrationConfigFactory({
      serviceId: CONTROL_ROOM_OAUTH_INTEGRATION_ID,
      proxy: true,
    });

    const locator = async () => [auth];
    await expect(
      mergeDeploymentIntegrationDependencies(deployment, locator)
    ).rejects.toThrow("No configuration found for integration");
  });

  test("reject multiple personal configurations", async () => {
    const deployment = deploymentFactory({
      package: deploymentPackageFactory({
        config: defaultModDefinitionFactory({
          extensionPoints: [
            modComponentDefinitionFactory({
              services: {
                [validateOutputKey("foo")]: CONTROL_ROOM_OAUTH_INTEGRATION_ID,
              },
            }),
          ],
        }),
      }),
    });

    const locator = async () => [
      sanitizedIntegrationConfigFactory({
        serviceId: CONTROL_ROOM_OAUTH_INTEGRATION_ID,
        proxy: false,
      }),
      sanitizedIntegrationConfigFactory({
        serviceId: CONTROL_ROOM_OAUTH_INTEGRATION_ID,
        proxy: false,
      }),
    ];
    await expect(
      mergeDeploymentIntegrationDependencies(deployment, locator)
    ).rejects.toThrow("Multiple local configurations found for integration:");
  });
});
