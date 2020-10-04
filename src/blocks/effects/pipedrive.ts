import { Effect } from "@/types";
import "notifyjs-browser";
import { faUserPlus } from "@fortawesome/free-solid-svg-icons";
import { proxyService } from "@/messaging/proxy";
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
      faUserPlus
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

  async effect({ pipedrive, name, owner_id }: BlockArg) {
    // @ts-ignore: write pipedrive response interface
    const { data } = await proxyService(pipedrive, {
      url: "https://api.pipedrive.com/v1/organizations/search",
      method: "get",
      params: {
        exact_match: true,
        term: name,
      },
    });

    if (data.items.length) {
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
    } catch (e) {
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
      faUserPlus
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

  async effect({ pipedrive, name, owner_id, email, phone }: BlockArg) {
    // @ts-ignore: write pipedrive response interface
    const { data } = await proxyService(pipedrive, {
      url: "https://api.pipedrive.com/v1/persons/search",
      method: "get",
      params: {
        exact_match: true,
        term: name,
      },
    });

    if (data.items.length) {
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
    } catch (e) {
      $.notify(`Error adding ${name} to Pipedrive`, "error");
    }
  }
}

registerBlock(new AddOrganization());
registerBlock(new AddPerson());
