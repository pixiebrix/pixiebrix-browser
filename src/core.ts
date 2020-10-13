import { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { AxiosRequestConfig } from "axios";
import { Primitive } from "type-fest";
import { ErrorObject } from "serialize-error";

export type TemplateEngine = "mustache" | "nunjucks" | "handlebars";

export type Schema = JSONSchema7;
export type SchemaDefinition = JSONSchema7Definition;
export type SchemaProperties = { [key: string]: SchemaDefinition };

export type RenderedHTML = string;

export interface Message {
  type: string;
  payload?: unknown;
}

export interface MessageContext {
  readonly extensionPointId?: string;
  readonly blockId?: string;
  readonly extensionId?: string;
  readonly serviceId?: string;
  readonly authId?: string;
}

export type SerializedError = Primitive | ErrorObject;

export interface Logger {
  childLogger: (context: MessageContext) => Logger;
  warn: (msg: string, data?: Record<string, unknown>) => void;
  debug: (msg: string, data?: Record<string, unknown>) => void;
  log: (msg: string, data?: Record<string, unknown>) => void;
  info: (msg: string, data?: Record<string, unknown>) => void;
  error: (
    error: SerializedError | Error,
    data?: Record<string, unknown>
  ) => void;
}

export interface BlockOptions {
  // Using "any" for now so that blocks don't have to assert/cast all their argument types. We're checking
  // the inputs using yup/jsonschema, so the types should match what's expected.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctxt: { [key: string]: any };
  logger: Logger;
}

// Using "any" for now so that blocks don't have to assert/cast all their argument types. We're checking
// the inputs using jsonschema, so the types should match what's expected.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BlockArg = { [key: string]: any };

export interface IOption {
  value: string | number | boolean;
  label: string;
}

export interface IPermissions {
  // Same structure as Permissions from Chrome
  permissions?: string[];
  origins?: string[];
}

export type BlockIcon = string | IconDefinition;

/**
 * Metadata about a block, extension point, or service
 */
export interface Metadata {
  id: string;
  name: string;
  description?: string;
  icon?: BlockIcon;
  author?: string;
}

// Using "any" for now so that blocks don't have to assert/cast all their argument types. We're checking
// the inputs using jsonschema, so the types should match what's expected.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BaseExtensionConfig = Record<string, any>;

export interface ServiceDependency {
  id: string;
  outputKey: string;
  config?: string;
}

export type ServiceLocator = (
  serviceId: string,
  id?: string
) => Promise<ConfiguredService>;

export interface IExtension<
  T extends BaseExtensionConfig = BaseExtensionConfig
> {
  id: string;
  extensionPointId: string;
  label?: string;
  templateEngine?: TemplateEngine;
  services: ServiceDependency[];
  config: T;
}

export interface IExtensionPoint extends Metadata {
  inputSchema: Schema;

  permissions: IPermissions;

  defaultOptions: { [key: string]: unknown };

  defaultReader: () => IReader;

  isAvailable: () => Promise<boolean>;

  install(): Promise<boolean>;

  addExtension(extension: IExtension): void;

  run(): Promise<void>;

  /**
   * Returns any blocks configured in extension.
   */
  getBlocks: (extension: IExtension) => IBlock[];
}

export interface IBlock extends Metadata {
  /** A JSON schema of the inputs for the block */
  inputSchema: Schema;

  /** An optional a JSON schema for the output of the block */
  outputSchema?: Schema;

  defaultOptions: { [key: string]: unknown };

  /**
   * Returns the optional permissions required to run this block
   * https://developer.chrome.com/extensions/permission_warnings
   */
  permissions: IPermissions;

  run: (value: BlockArg, options: BlockOptions) => Promise<unknown>;
}

export interface ReaderOutput {
  [key: string]: unknown;
}

/**
 * A block that can read data from a page or part of the page.
 */
export interface IReader extends IBlock {
  /** Return true if the Reader is for a page/element. */
  isAvailable: ($elt?: JQuery) => Promise<boolean>;

  read: ($elt?: JQuery) => Promise<ReaderOutput>;
}

type ServiceId = string;

export type ServiceConfig = Record<string, string | null>;

/** Service configuration provided by a user. */
export interface RawServiceConfiguration {
  id: string | undefined;
  serviceId: ServiceId;
  label: string | undefined;
  config: ServiceConfig;
}

export interface ConfiguredService {
  /**
   * UUID of the service configuration
   */
  id?: string;

  serviceId: ServiceId;

  /**
   * Sanitized configuration, i.e., excluding secrets and keys.
   */
  config: ServiceConfig;

  /**
   * true if the service must be proxied for remote configs, e.g., because it has a secret it needs
   * to use to authenticate.
   */
  proxy: boolean;
}

/**
 * A service that can be dependency injected and used to authenticate external requests.
 *
 * The input/output schema is the same since it's directly user configured.
 */
export interface IService<TConfig extends ServiceConfig = ServiceConfig>
  extends Metadata {
  schema: Schema;

  authenticateRequest: (
    serviceConfig: TConfig,
    requestConfig: AxiosRequestConfig
  ) => AxiosRequestConfig;
}
