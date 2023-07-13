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

import { type UUID } from "@/types/stringTypes";
import { type RegistryId } from "@/types/registryTypes";
import { pull, remove } from "lodash";
import defaultActions from "@/components/quickBar/defaultActions";
import {
  type ActionGenerator,
  type ActionsChangeHandler,
  type CustomAction,
  type GeneratorArgs,
} from "@/components/quickBar/quickbarTypes";

class QuickBarRegistry {
  /**
   * Current set of actions, including static and generated actions.
   * @see actionGenerators
   * @see addAction
   * @private
   */
  private readonly actions: CustomAction[] = [...defaultActions];

  /**
   * Registry of action listeners, called when the set of actions changes.
   * @private
   */
  private readonly listeners: ActionsChangeHandler[] = [];

  /**
   * Registry of action generators. The generators are called when the user types in the Quick Bar.
   * @private
   */
  private readonly actionGenerators: ActionGenerator[] = [];

  /**
   * Abort controller for the currently running action generator.
   * @private
   */
  private generatorAbortController: AbortController | null = null;

  /**
   * Mapping from action generator to the rootActionId.
   *
   * Used to determine whether to nest a generated action under a root action because the AddQuickBarAction doesn't
   * have access to the generator.
   *
   * @private
   * @see AddQuickBarAction
   * @see knownGeneratorRootIds
   */
  private readonly generatorRootIdMap: Map<ActionGenerator, string> = new Map<
    ActionGenerator,
    string
  >();

  /**
   * Helper method to notify all action listeners that the set of actions changed.
   * @private
   */
  private notifyListeners() {
    // Need to copy the array because the registry mutates the array in-place, and listeners might be keeping a
    // reference to the argument passed to them
    const copy = [...this.actions];
    for (const listener of this.listeners) {
      listener(copy);
    }
  }

  /**
   * Get the current actions registered with the Quick Bar.
   */
  get currentActions(): CustomAction[] {
    // Return a copy, since this.actions is mutated in-place
    return [...this.actions];
  }

  /**
   * Return set of root action ids in the KBar. The caller can use to determine whether to nest a generated action
   * under a given root action.
   */
  get knownGeneratorRootIds(): Set<string> {
    return new Set(this.generatorRootIdMap.values());
  }

  /**
   * Add or replace a Quick Bar action.
   * @param action the quick bar action to add.
   */
  addAction(action: CustomAction): void {
    const index = this.actions.findIndex((x) => x.id === action.id);

    if (index >= 0) {
      // Preserve the relative insertion order of actions with the same priority.
      // eslint-disable-next-line security/detect-object-injection -- guaranteed to be a number
      this.actions[index] = action;
    } else if (action.parent) {
      // Items with a parent must appear _after_ the parent in this.actions. Otherwise, KBar won't properly
      // nest the items because the parent item will be overwritten with no children.
      this.actions.push(action);
    } else {
      // Put at the front of the list so they appear before the other actions with the same Priority
      this.actions.unshift(action);
    }

    this.notifyListeners();
  }

  /**
   * Remove all actions added by a given extension point.
   * @param extensionPointId the extension point registry id.
   */
  removeExtensionPointActions(extensionPointId: RegistryId): void {
    remove(this.actions, (x) => x.extensionPointId === extensionPointId);
    this.notifyListeners();
  }

  /**
   * Remove all actions added by a given extension.
   * @param extensionId the ModComponentBase UUID
   */
  removeExtensionActions(extensionId: UUID): void {
    remove(this.actions, (x) => x.extensionId === extensionId);
    this.notifyListeners();
  }

  /**
   * Remove a single action from the Quick Bar
   * @param actionId the action id (not the action name)
   */
  removeAction(actionId: string): void {
    remove(this.actions, (x) => x.id === actionId);
    this.notifyListeners();
  }

  /**
   * Add a action change handler.
   * @param handler the action change handler
   */
  addListener(handler: ActionsChangeHandler): void {
    this.listeners.push(handler);
  }

  /**
   * Remove an action change handler.
   * @param handler the action change handler
   */
  removeListener(handler: ActionsChangeHandler): void {
    pull(this.listeners, handler);
  }

  /**
   * Register an action generator.
   * @param generator the action generator
   * @param rootActionId an optional rootActionId to associate with the generator
   */
  addGenerator(generator: ActionGenerator, rootActionId: string | null): void {
    this.actionGenerators.push(generator);
    this.generatorRootIdMap.set(generator, rootActionId);
  }

  /**
   * Remove a registered action generator, or NOP if the generator is not registered.
   * @param generator the action generator
   */
  removeGenerator(generator: ActionGenerator): void {
    pull(this.actionGenerators, generator);
    this.generatorRootIdMap.delete(generator);
  }

  /**
   * Generate actions for all registered generators.
   *
   * The generator is responsible for cleaning up any previously added actions.
   *
   * @param args arguments to pass to action generators
   */
  async generateActions(args: GeneratorArgs): Promise<void> {
    // Abort previously running generators
    this.generatorAbortController?.abort();

    // Run all generators in parallel
    this.generatorAbortController = new AbortController();
    await Promise.allSettled(
      this.actionGenerators.map(async (x) =>
        x({ ...args, abortSignal: this.generatorAbortController.signal })
      )
    );
  }
}

/**
 * Singleton registry for the content script
 */
const quickBarRegistry = new QuickBarRegistry();

export default quickBarRegistry;
