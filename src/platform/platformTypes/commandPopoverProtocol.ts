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

import type { UUID } from "@/types/stringTypes";

export type TextCommand = {
  /**
   * The mod component id that owns the command/snippet
   */
  componentId: UUID;
  /**
   * The shortcut to trigger the command, excluding the command key
   */
  shortcut: string;
  /**
   * The title/label of the snippet
   */
  title: string;
  /**
   * An optional preview of the text to insert
   * @since 1.8.11
   */
  preview?: string;
  /**
   * The text generator
   * @param currentText current text in the editor
   */
  handler: (currentText: string) => Promise<string>;
};

/**
 * Protocol for a text command popover triggered by a command key
 * @since 1.8.10
 */
export interface CommandPopoverProtocol {
  /**
   * Register a text command
   * @param command the command definition
   */
  register(command: TextCommand): void;

  /**
   * Unregister all text commands for a given mod component
   * @param modComponentId the owner mod component
   */
  unregister(modComponentId: UUID): void;
}
