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

import { Effect } from "@/types";
import { proxyService } from "@/background/requests";
import { registerBlock } from "@/blocks/registry";
import { propertiesToSchema } from "@/validators/generic";
import { BlockArg } from "@/core";

export class AddOrganization extends Effect {
  // https://developers.pipedrive.com/docs/api/v1/#!/Organizations/post_organizations

  constructor() {
    super(
      "pipedrive/organizations-add",
      "Add Organization in Pipedrive",
      "Add an organization in Pipedrive CRM if it does not already exist",
      "faUserPlus"
    );
  }

  inputSchema = propertiesToSchema(
    {
      pipedrive: {
        $ref: "https://app.pixiebrix.com/schemas/services/pipedrive/api",
      },
      name: {
        type: "string",
        description: "Organization name",
      },
      owner_id: {
        type: "integer",
        description:
          "ID of the user who will be marked as the owner of this person. When omitted, the authorized user ID will be used.",
      },
    },
    ["name"]
  );

  async effect({ pipedrive, name, owner_id }: BlockArg): Promise<void> {
    const { data } = await proxyService<{ items: unknown[] }>(pipedrive, {
      url: "https://api.pipedrive.com/v1/organizations/search",
      method: "get",
      params: {
        exact_match: true,
        term: name,
      },
    });

    if (data.items.length > 0) {
      $.notify(`Organization already exists for ${name}`, "info");
      return;
    }

    try {
      await proxyService(pipedrive, {
        url: "https://api.pipedrive.com/v1/organizations",
        method: "post",
        data: { name, owner_id },
      });
      $.notify(`Added ${name} to Pipedrive`, "success");
    } catch {
      $.notify(`Error adding ${name} to Pipedrive`, "error");
    }
  }
}

export class AddPerson extends Effect {
  // https://developers.pipedrive.com/docs/api/v1/#!/Persons/post_persons

  constructor() {
    super(
      "pipedrive/persons-add",
      "Add Person in Pipedrive",
      "Add a person in Pipedrive CRM if they do not already exist",
      "faUserPlus"
    );
  }

  inputSchema = propertiesToSchema(
    {
      pipedrive: {
        $ref: "https://app.pixiebrix.com/schemas/services/pipedrive/api",
      },
      name: {
        type: "string",
        description: "Person name",
      },
      owner_id: {
        type: "integer",
        description:
          "ID of the user who will be marked as the owner of this person. When omitted, the authorized user ID will be used.",
      },
      email: {
        type: "string",
        description: "Email address associated with the person.",
      },
      phone: {
        type: "string",
        description: "Phone number associated with the person",
      },
    },
    ["name"]
  );

  async effect({
    pipedrive,
    name,
    owner_id,
    email,
    phone,
  }: BlockArg): Promise<void> {
    const { data } = await proxyService<{ items: unknown[] }>(pipedrive, {
      url: "https://api.pipedrive.com/v1/persons/search",
      method: "get",
      params: {
        exact_match: true,
        term: name,
      },
    });

    if (data.items.length > 0) {
      $.notify(`Person record already exists for ${name}`, "info");
      return;
    }

    try {
      await proxyService(pipedrive, {
        url: "https://api.pipedrive.com/v1/persons",
        method: "post",
        data: {
          name,
          owner_id,
          email: email ? [email] : undefined,
          phone: phone ? [phone] : undefined,
        },
      });
      $.notify(`Added ${name} to Pipedrive`, "success");
    } catch {
      $.notify(`Error adding ${name} to Pipedrive`, "error");
    }
  }
}

registerBlock(new AddOrganization());
registerBlock(new AddPerson());
