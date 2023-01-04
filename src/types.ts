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
  type AuthData,
  type BlockArg,
  type BlockIcon,
  type BlockOptions,
  type IBlock,
  type IReader,
  type IService,
  type KeyedConfig,
  type OAuth2Context,
  type ReaderOutput,
  type RegistryId,
  type RendererOutput,
  type Schema,
  type TokenContext,
} from "@/core";
import { type AxiosRequestConfig } from "axios";
import { validateRegistryId } from "@/types/helpers";

type SanitizedBrand = { _sanitizedConfigBrand: null };
type SecretBrand = { _serviceConfigBrand: null };

/**
 * Type to be preferred over a plain `object`
 * https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/ban-types.md
 */
export type UnknownObject = Record<string, unknown>;

export abstract class Service<
  TConfig extends KeyedConfig = KeyedConfig,
  TOAuth extends AuthData = AuthData
> implements IService<TConfig>
{
  abstract schema: Schema;

  abstract hasAuth: boolean;

  abstract get isOAuth2(): boolean;

  abstract get isAuthorizationGrant(): boolean;

  abstract get isToken(): boolean;

  abstract get isBasicHttpAuth(): boolean;

  protected constructor(
    public id: RegistryId,
    public name: string,
    public description?: string,
    public icon?: BlockIcon
  ) {
    // No body necessary https://www.typescriptlang.org/docs/handbook/2/classes.html#parameter-properties
  }

  abstract getOrigins(serviceConfig: TConfig & SanitizedBrand): string[];

  abstract getOAuth2Context(
    serviceConfig: TConfig & SecretBrand
  ): OAuth2Context;

  abstract getTokenContext(serviceConfig: TConfig & SecretBrand): TokenContext;

  abstract authenticateRequest(
    serviceConfig: TConfig & SecretBrand,
    requestConfig: AxiosRequestConfig,
    authConfig?: TOAuth
  ): AxiosRequestConfig;
}

export abstract class Block implements IBlock {
  readonly id: RegistryId;

  readonly name: string;

  readonly description: string;

  readonly icon: BlockIcon;

  abstract readonly inputSchema: Schema;

  outputSchema?: Schema = undefined;

  readonly permissions = {};

  readonly defaultOptions = {};

  async isPure(): Promise<boolean> {
    // Safe default
    return false;
  }

  async isRootAware(): Promise<boolean> {
    // Safe default
    return true;
  }

  protected constructor(
    id: string,
    name: string,
    description?: string,
    icon?: BlockIcon
  ) {
    this.id = validateRegistryId(id);
    this.name = name;
    this.description = description;
    this.icon = icon;
  }

  abstract run(value: BlockArg, options: BlockOptions): Promise<unknown>;
}

export abstract class Effect extends Block {
  override async isRootAware(): Promise<boolean> {
    // Most effects don't use the root, so have them opt-in
    return false;
  }

  abstract effect(inputs: BlockArg, env?: BlockOptions): Promise<void>;

  async run(value: BlockArg, options: BlockOptions): Promise<void> {
    return this.effect(value, options);
  }
}

export abstract class Transformer extends Block {
  override async isRootAware(): Promise<boolean> {
    // Most transformers don't use the root, so have them opt-in
    return false;
  }

  abstract transform(value: BlockArg, options: BlockOptions): Promise<unknown>;

  async run(value: BlockArg, options: BlockOptions): Promise<unknown> {
    return this.transform(value, options);
  }
}

export abstract class Renderer extends Block {
  abstract render(
    inputs: BlockArg,
    options: BlockOptions
  ): Promise<RendererOutput>;

  override async isRootAware(): Promise<boolean> {
    // Most renderers don't use the root, so have them opt-in
    return false;
  }

  async run(value: BlockArg, options: BlockOptions): Promise<RendererOutput> {
    return this.render(value, options);
  }
}

export abstract class Reader extends Block implements IReader {
  readonly inputSchema: Schema = {};

  override outputSchema: Schema = undefined;

  override async isRootAware(): Promise<boolean> {
    // Most readers use the root, so have them opt-out if they don't
    return true;
  }

  abstract isAvailable($elements?: JQuery): Promise<boolean>;

  abstract read(root: HTMLElement | Document): Promise<ReaderOutput>;

  async run({ root }: BlockArg): Promise<ReaderOutput> {
    return this.read(root);
  }
}

export type Target = {
  tabId: number;
  frameId: number;
};
