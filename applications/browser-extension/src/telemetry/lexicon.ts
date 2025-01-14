/*
 * Copyright (C) 2024 PixieBrix, Inc.
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

import { type JSONSchema } from "@apidevtools/json-schema-ref-parser/dist/lib/types";
import { Events } from "./events";
import { type ValueOf } from "type-fest";

const LexiconTags = {
  PAGE_EDITOR: "page editor",
  MOD_ACTIVATION: "mod activation",
  EXTENSION_CONSOLE: "extension console",
  MOD_RUNTIME: "mod runtime",
  ENTERPRISE: "enterprise",
  TEAM: "team",
  OBSOLETE: "obsolete",
  AUTHENTICATION: "authentication",
} as const;

type LexiconTag = ValueOf<typeof LexiconTags>;

/**
 * Entry for a single event in the Mixpanel Lexicon, used to communicate the intended use of the event to
 * non-technical stakeholders.
 * See https://docs.mixpanel.com/docs/data-governance/lexicon for more information on the Mixpanel Lexicon and it's
 * intended use.
 */
interface LexiconEventEntry {
  /**
   * Description of the event that displays in the Mixpanel interface. Good descriptions describe what the event is,
   * specifically when and/or where in the UI it's triggered, and what the implications of the event being triggered
   * are (e.g. does clicking a button mean that something was successful? Or does it just represent the click itself?).
   */
  description: string;
  /**
   * Tags to categorize the event in the Mixpanel interface. Typically used to group related events together.
   */
  tags?: LexiconTag[];
  /**
   * True if the event should be hidden from the Mixpanel interface. Hidden events are still tracked (granted they are
   * reported to Mixpanel), but since they are hidden they will be discouraged from being used in reports.
   *
   * "Hidden" is the preferred way to deprecate or make an event obsolete, and differs from "dropped" in that it is less
   * severe; dropped events are intercepted by Mixpanel and not reported at all, and is thus error-prone.
   */
  hidden?: boolean;
}

/**
 * Map of Mixpanel event names to Lexicon event entries.
 */
type LexiconMap = {
  [K in keyof typeof Events]: LexiconEventEntry;
};

// @ts-expect-error -- TODO: Remove this when the Lexicon is fully implemented https://github.com/pixiebrix/pixiebrix-extension/issues/9151
export const lexicon: LexiconMap = {
  ACTIVATION_INTEGRATION_ADD_NEW_CLICK: {
    description:
      "Reported on the mod activation page in the Extension Console when a user selects the '+ Add new' option to " +
      "create a new integration configuration for the mod. A modal should appear for the user to create the configuration, " +
      "but this event is triggered specifically when '+ Add new' option is clicked." +
      "\n" +
      `Not to be confused with the ${getDisplayName(
        "INTEGRATION_WIDGET_CONFIGURE_LINK_CLICK",
      )} event, which is reported in the Page Editor.`,
    tags: [LexiconTags.MOD_ACTIVATION, LexiconTags.EXTENSION_CONSOLE],
  },
  ACTIVATION_INTEGRATION_ADD_NEW_CLOSE: {
    description:
      "Reported on the mod activation page in the Extension Console when a user closes the modal for creating a new " +
      "integration configuration for the mod (either by clicking 'Cancel', 'Save' or 'X' in the modal).",
    tags: [LexiconTags.MOD_ACTIVATION, LexiconTags.EXTENSION_CONSOLE],
  },
  ACTIVATION_INTEGRATION_CONFIG_SELECT: {
    description:
      "Reported on the mod activation page in the Extension Console when a user selects an option in the dropdown menu " +
      "to configure an integration for the mod. This includes when a new integration is auto-filled after creating " +
      "the integration via the '+ Add new' option." +
      "\n" +
      `Not to be confused with the ${getDisplayName(
        "INTEGRATION_WIDGET_SELECT",
      )} event, which is reported in the Page Editor.`,
    tags: [LexiconTags.MOD_ACTIVATION, LexiconTags.EXTENSION_CONSOLE],
  },
  ACTIVATION_INTEGRATION_REFRESH: {
    description:
      "Reported on the mod activation page in the Extension Console when a user clicks the integration 'Refresh' button to " +
      "refresh the list of available integrations." +
      "\n" +
      `Not to be confused with the ${getDisplayName(
        "INTEGRATION_WIDGET_REFRESH",
      )} event, which is reported in the Page Editor.`,
    tags: [LexiconTags.MOD_ACTIVATION, LexiconTags.EXTENSION_CONSOLE],
  },
  BRICK_ADD: {
    description:
      'Triggered when a user successfully adds a brick to a Mod in the Page Editor via clicking "Add" or "Add brick" in the Add Brick modal.',
    tags: [LexiconTags.PAGE_EDITOR],
  },
  BRICK_COMMENTS_UPDATE: {
    description:
      "Triggered when a user updates the brick comment in the 'comments' tab of the Data Panel in the Page Editor. More specifically, " +
      "when a user modifies the comment and leaves the field.",
    tags: [LexiconTags.PAGE_EDITOR],
  },
  BROWSER_ACTION_RESTRICTED_URL: {
    description:
      "Reported when a user sees the restricted webpage warning 'PixieBrix cannot access this page' when opening the " +
      "PixieBrix sidebar on a restricted page, e.g. the Extension Console or a new browser tab.",
    tags: [LexiconTags.MOD_RUNTIME],
  },
  CUSTOM_USER_EVENT: {
    description:
      "Event reported from the 'Send Telemetry' brick in a mod. Mod developers can customize the `eventName` " +
      "property and add additional properties to this event at will.",
    tags: [LexiconTags.MOD_RUNTIME],
  },
  DATA_PANEL_TAB_VIEW: {
    description:
      "Reported when a Data Panel tab is shown in the Page Editor, including when the Data Panel first renders " +
      "and when a user switches between data panel tabs by clicking on the tab.",
    tags: [LexiconTags.PAGE_EDITOR],
  },
  DEPLOYMENT_ACTIVATE: {
    description:
      "Triggered when when a user successfully activates a team deployment via the Extension Console by clicking the " +
      '"Activate" button in the team deployment banner, OR when a deployed mod is auto-activated in the background ' +
      "of the PixieBrix Extension (including when a deployment specifies an update to a mod that is currently active). " +
      "See event properties for information on how the mod was activated (e.g. 'manual' or 'auto').",
    tags: [LexiconTags.TEAM, LexiconTags.MOD_ACTIVATION],
  },
  DEPLOYMENT_DEACTIVATE_ALL: {
    description:
      "Triggered when the PixieBrix Extension automatically deactivates all deployed mods for a user at once in the" +
      "background. This should only happen if the user is no longer part of any team, e.g. if the user is removed from " +
      "their only team, or the user links the PixieBrix Extension to a different account with no team " +
      "affiliation.",
    tags: [LexiconTags.TEAM],
  },
  DEPLOYMENT_DEACTIVATE_UNASSIGNED: {
    description:
      "Triggered when the PixieBrix Extension successfully deactivates all deployments that have been unassigned to " +
      "this user. This is done automatically in the background or on the Mods Page in the Extension Console.\nA user " +
      "is assigned to a deployment by belonging to a group assigned to the deployment.",
    tags: [LexiconTags.TEAM],
  },
  DEPLOYMENT_LIST: {
    description:
      "Reported every 5 minutes from the background when the PixieBrix Extension fetches deployments for users" +
      "that belong to a team, with a list of all deployment ids for that user. This event is only reported for " +
      "certain teams as specified by the `report-background-deployments` feature flag (see the Django Admin for a list " +
      "of users with this flag).",
    tags: [LexiconTags.TEAM, LexiconTags.ENTERPRISE],
  },
  DEPLOYMENT_REJECT_PERMISSIONS: {
    description:
      "Triggered when a user declines browser permissions required to activate a deployed mod by clicking 'Cancel' or " +
      "'Deny' on the browser permissions prompt. Team deployment activation is initiated by clicking \"Activate\" on " +
      "the team deployment banner in the Extension Console.",
    tags: [LexiconTags.TEAM, LexiconTags.EXTENSION_CONSOLE],
  },
  DEPLOYMENT_REJECT_VERSION: {
    description:
      "Reported on the Mods Page in the Extension Console when a user is prompted to update the Extension " +
      "in order to activate a deployed mod. The event is triggered after the user clicks 'Activate' on the deployment " +
      "activation modal.",
    tags: [LexiconTags.TEAM, LexiconTags.EXTENSION_CONSOLE],
  },
  DEPLOYMENT_SYNC: {
    description:
      "Reported every 5 minutes from the background when the PixieBrix Extension checks for deployment updates for users " +
      "that belong to a team. See event properties for information on update prompt status (the prompt shown to users " +
      "to activate deployed mods that can't be auto-activated in the background). This event is only reported for " +
      "certain teams as specified by the `report-background-deployments` feature flag (see the Django Admin for a list " +
      "of users with this flag).",
    tags: [LexiconTags.TEAM, LexiconTags.ENTERPRISE],
  },
  DEPLOYMENT_UPDATE_LIST: {
    description:
      "Reported every 5 minutes from the background when the PixieBrix Extension fetches deployments for users" +
      "that belong to a team, with a list of deployments for that user that have updates available. This event is only " +
      "reported for certain teams as specified by the `report-background-deployments` feature flag (see the Django " +
      "Admin for a list of users with this flag).",
    tags: [LexiconTags.TEAM, LexiconTags.ENTERPRISE],
  },
  DEVTOOLS_CLOSE: {
    description:
      "Reported when the DevTools are closed on any modifiable web page (e.g. this event is not reported when opening the " +
      "DevTools in the Extension Console or on internal chrome pages).",
    tags: [LexiconTags.PAGE_EDITOR],
  },
  DEVTOOLS_OPEN: {
    description:
      "Reported when the a user opens the DevTools on any modifiable web page (e.g. this event is not reported when opening the " +
      "DevTools in the Extension Console or on internal chrome pages).",
    tags: [LexiconTags.PAGE_EDITOR],
  },
  EXTENSION_CONSOLE_MOD_ACTIVATE: {
    description:
      "[DEPRECATED] Triggered when a user clicks the 'Activate' button in the Extension Console on the mod " +
      "activation page. Does not indicate activation success.\n" +
      `This event is deprecated in favor of the ${getDisplayName(
        "MOD_ACTIVATE",
      )} event, filtered by event property source='extensionConsole'.`,
    hidden: true,
    tags: [LexiconTags.MOD_ACTIVATION, LexiconTags.EXTENSION_CONSOLE],
  },
  FACTORY_RESET: {
    description:
      "Reported when a user performs a factory reset of the PixieBrix Extension, which is available via " +
      "the Extension Console settings page. This event is triggered after the user confirms the factory reset action.",
    tags: [LexiconTags.EXTENSION_CONSOLE],
  },
  FLOATING_ACTION_BUTTON_CLICK: {
    description:
      "Reported when a user clicks the floating action button on any web page for which it is shown.",
    tags: [LexiconTags.MOD_RUNTIME],
  },
  FLOATING_ACTION_BUTTON_ON_SCREEN_HIDE: {
    description:
      "Reported when the floating action button is hidden by clicking the 'Hide Button' button " +
      "that appears when hovering over the floating action button. Sets the Floating Action Button setting to 'disabled' " +
      "in the Extension Console settings.",
    tags: [LexiconTags.MOD_RUNTIME],
  },
  FLOATING_ACTION_BUTTON_REPOSITION: {
    description:
      "Reported when the floating action button is repositioned on the page by clicking the drag handle and moving " +
      "the button to a new location. Only reported once per page load.",
    tags: [LexiconTags.MOD_RUNTIME],
  },
  GOOGLE_FILE_PICKER_EVENT: {
    description: "[OBSOLETE] This event is no longer in use.",
    hidden: true,
    tags: [LexiconTags.OBSOLETE],
  },
  HANDLE_CONTEXT_MENU: {
    description:
      "Triggered by running a Context Menu starter brick, as a result of a user clicking a PixieBrix context menu item on a modified web page.\n" +
      "\n" +
      "Does not necessarily indicate a successful mod run.",
    tags: [LexiconTags.MOD_RUNTIME],
  },
  HANDLE_QUICK_BAR: {
    description:
      "Triggered by running a Quickbar mod, as a result of opening the Quickbar on a modified web page and selecting " +
      "a mod to run by clicking on the mod or pressing 'enter' on the keyboard with the mod highlighted." +
      "\n" +
      "Does not necessarily indicate a successful mod run.",
    tags: [LexiconTags.MOD_RUNTIME],
  },
  IDB_RECLAIM_QUOTA: {
    description:
      "Reported when a user clicks the 'Reclaim Space' button on the IndexedDB (IDB) error display in the Extension " +
      "Console when the user gets a 'Insufficient storage space available to PixieBrix' error.",
    tags: [LexiconTags.EXTENSION_CONSOLE],
  },
  IDB_RECOVER_CONNECTION: {
    description:
      "Reported when a user clicks the 'Recover Connection' button on the IndexedDB (IDB) error display in the Extension " +
      "Console when the user gets a 'Error connecting to local database' error.",
    tags: [LexiconTags.EXTENSION_CONSOLE],
  },
  IDB_UNRESPONSIVE_BANNER: {
    description:
      "Reported when the error banner containing the message 'We're having trouble connecting to your browser's local database, please restart " +
      "your browser' for IndexedDB (IDB) errors is shown in the Extension Console",
    tags: [LexiconTags.EXTENSION_CONSOLE],
  },
  INTEGRATION_WIDGET_CLEAR: {
    description:
      "Reported in the Page Editor when a user clears the integration field for a brick that uses an integration " +
      "by clicking the 'X' button in the field.",
    tags: [LexiconTags.PAGE_EDITOR],
  },
  INTEGRATION_WIDGET_CONFIGURE_LINK_CLICK: {
    description:
      "Reported in the Page Editor when a user clicks the 'Configure additional integrations here' link included " +
      "underneath integration fields for bricks that use integrations." +
      "\n" +
      `Not to be confused with the ${getDisplayName(
        "ACTIVATION_INTEGRATION_ADD_NEW_CLICK",
      )} event, which is reported when activating a mod ` +
      "in the Extension Console.",
    tags: [LexiconTags.PAGE_EDITOR],
  },
  INTEGRATION_WIDGET_REFRESH: {
    description:
      "Reported in the Page Editor when a user clicks the refresh button to the right of the integration field " +
      "for a brick that uses an integration." +
      "\n" +
      `Not to be confused with the ${getDisplayName(
        "ACTIVATION_INTEGRATION_REFRESH",
      )} event, which is reported when activating a mod ` +
      "in the Extension Console.",
    tags: [LexiconTags.PAGE_EDITOR],
  },
  INTEGRATION_WIDGET_SELECT: {
    description:
      "Reported in the Page Editor when a user selects a configuration from the integration field dropdown for a brick that uses an " +
      "integration." +
      "\n" +
      `Not to be confused with the ${getDisplayName(
        "ACTIVATION_INTEGRATION_CONFIG_SELECT",
      )} event, which is reported when activating a mod ` +
      "in the Extension Console.",
    tags: [LexiconTags.PAGE_EDITOR],
  },
  LINK_EXTENSION: {
    description:
      "Triggered when the PixieBrix Extension authentication is obtained or updated by via visiting " +
      "the Admin Console after successfully logging in. If authenticated, the Admin " +
      "Console sends auth info in the PixieBrix Extension, a process we call 'linking'. If the " +
      "extension is not linked, the user will be blocked by 'Link Extension' screens in the Extension Console, Page Editor, " +
      "and Sidebar, as the majority of extension features will not work without authentication.",
    tags: [LexiconTags.AUTHENTICATION],
  },
  PAGE_EDITOR_CLEAR_CHANGES: {
    description:
      "Reported when Clear Changes is clicked in 3-dot action action menu for a mod/mod component in the Page Editor",
    tags: [LexiconTags.PAGE_EDITOR],
  },
};

/**
 * Converts an Events key to capitalized camel case, for use with updating the display name for events.
 * @param key A valid key of the Events object
 * @returns The key in capitalized camel case format
 */
function convertEventKeyToCapitalizedCamelCase(
  key: keyof typeof Events,
): string {
  return key
    .toLowerCase()
    .split("_")
    .map((word, index) =>
      index === 0
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join("");
}

/**
 * Returns a display name for the given event if needed (i.e. the new event name different from the original event name).
 * @param key A valid key of the Events object
 * @returns a capitalized camel case string representing the display name for the event, or null if
 * a display name is not needed.
 */
function getDisplayName(key: keyof typeof Events) {
  const newEventName = convertEventKeyToCapitalizedCamelCase(key);
  // eslint-disable-next-line security/detect-object-injection -- eventKey is a constant
  return newEventName === Events[key] ? null : newEventName;
}

/**
 * Transforms a LexiconMap into a JSON schema that can be used in the request body to upload the Lexicon to Mixpanel.
 * See expected shape here https://developer.mixpanel.com/reference/upload-schemas-for-project
 */
export function transformLexiconMapToRequestSchema(
  lexiconMap: LexiconMap,
): JSONSchema {
  const entries = Object.entries(lexiconMap).map(
    ([eventKey, entry]: [keyof typeof Events, LexiconEventEntry]) => ({
      entityType: "event",
      // eslint-disable-next-line security/detect-object-injection -- eventKey is a constant
      name: Events[eventKey],
      schemaJson: {
        $schema: "http://json-schema.org/draft-07/schema",
        description: entry.description,
        additionalProperties: true,
        metadata: {
          "com.mixpanel": {
            tags: entry.tags,
            displayName: getDisplayName(eventKey),
            hidden: entry.hidden ?? false,
            dropped: false,
          },
        },
      },
    }),
  );

  return {
    entries,
    truncate: false,
  };
}
