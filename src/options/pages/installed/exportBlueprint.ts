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

import { fromPairs } from "lodash";
import { IExtension } from "@/core";
import { objToYaml } from "@/utils/objToYaml";
import { saveAs } from "file-saver";

export function exportBlueprint(extension: IExtension) {
  const {
    extensionPointId,
    label,
    templateEngine,
    permissions,
    definitions,
    services,
    optionsArgs,
    config,
  } = extension;

  const blueprint = {
    apiVersion: "v1",
    kind: "recipe",
    metadata: {
      id: "",
      name: label,
      description: "Blueprint exported from PixieBrix",
      version: "1.0.0",
    },
    definitions,
    extensionPoints: [
      {
        id: extensionPointId,
        label,
        services: fromPairs(
          services
            .filter((x) => x.outputKey !== null)
            .map(({ outputKey, id }) => [outputKey, id])
        ),
        templateEngine,
        permissions,
        optionsArgs,
        config,
      },
    ],
  };

  const blueprintYAML = objToYaml(blueprint);
  const blob = new Blob([blueprintYAML], { type: "text/plain;charset=utf-8" });
  saveAs(blob, "blueprint.yaml");
}
