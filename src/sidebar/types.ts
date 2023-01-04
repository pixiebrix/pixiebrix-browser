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

import { type RegistryId, type UUID } from "@/core";
import { type FormDefinition } from "@/blocks/transformers/ephemeralForm/formTypes";
import { type RendererPayload } from "@/runtime/runtimeTypes";

export type RendererError = {
  /**
   * A unique id for the content, used control re-rendering (similar to `key` in React)
   */
  key: string;
  /**
   * The error message to show in the panel
   */
  // TypeScript was having problems handling the type SerializedError here
  error: unknown;
  /**
   * The extension run id.
   * @since 1.7.0
   */
  runId: UUID;
  /**
   * The extension id that produced the error
   * @since 1.7.0
   */
  extensionId: UUID;
};

/**
 * Entry types supported by the sidebar.
 *
 * Current supports panels and ephemeral forms. In the future we may also support button entries, etc.
 *
 * @see PanelEntry
 * @see FormEntry
 */
export type EntryType = "panel" | "form" | "temporaryPanel";

/**
 * The information required to run the renderer of a pipeline, or error information if the pipeline run errored.
 */
export type PanelPayload = RendererPayload | RendererError | null;

type BasePanelEntry = {
  /**
   * The id of the extension that added the panel
   */
  extensionId: UUID;
  /**
   * Heading for tab name in the sidebar
   */
  heading: string;
  /**
   * The information required to run the renderer of a pipeline, or error information if the pipeline run errored.
   */
  payload: PanelPayload;
};

/**
 * A panel added by an extension attached to an SidebarExtensionPoint
 * @see SidebarExtensionPoint
 */
export type PanelEntry = BasePanelEntry & {
  /**
   * The blueprint associated with the extension that added the panel.
   *
   * Used to give preference to blueprint side panels when using the "Show Sidebar" brick.
   *
   * @since 1.6.5
   */
  blueprintId: RegistryId | null;
  /**
   * The sidebar extension point
   * @see SidebarExtensionPoint
   */
  extensionPointId: RegistryId;
};

/**
 * An ephemeral panel to show in the sidebar. Only one temporary panel can be shown from an extension at a time.
 */
export type TemporaryPanelEntry = BasePanelEntry & {
  /**
   * Unique identifier for the temporary panel instance. Used to correlate panel-close action.
   */
  nonce: UUID;
};

/**
 * An ephemeral form to show in the sidebar. Only one form can be shown from an extension at a time.
 * @see ModalTransformer
 */
export type FormEntry = {
  /**
   * The extension that created the form
   */
  extensionId: UUID;
  /**
   * Unique identifier for the form instance. Used to correlate form submission/cancellation.
   */
  nonce: UUID;
  /**
   * The form schema and configuration
   */
  form: FormDefinition;
};

/**
 * The entries currently added to the sidebar
 */
export type SidebarEntries = {
  panels: PanelEntry[];
  forms: FormEntry[];
  temporaryPanels: TemporaryPanelEntry[];
};

/**
 * A request to activate a panel in the sidebar
 * @since 1.6.5
 */
export type ActivatePanelOptions = {
  /**
   * Force-activate the panel, even if the user is currently viewing a different panel that doesn't match the criteria
   *
   * @since 1.6.5
   */
  force?: boolean;

  /**
   * Refresh the panel content (default=true).
   *
   * Has no effect if the sidebar is not already showing
   *
   * @since 1.7.0
   */
  refresh?: boolean;

  /**
   * The id of the extension panel to show. Included so the Page Editor can request a specific panel to show when
   * editing the extension
   *
   * @since 1.6.5
   */
  extensionId?: UUID;
  /**
   * The blueprint of the extension panel to show
   *
   * @since 1.6.5
   */
  blueprintId?: RegistryId;
  /**
   * A panel heading name to match
   *
   * @since 1.6.5
   */
  panelHeading?: string;
};

/**
 * Metadata about the extension that produced the panel content
 * @since 1.7.0
 */
export type PanelRunMeta = {
  runId: UUID;
  extensionId: UUID;
};
