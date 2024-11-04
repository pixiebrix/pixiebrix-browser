import type { SyncPolicy } from "@/platform/state/stateTypes";
import type { JSONSchema7TypeName } from "json-schema";

export type ModVariable = {
  /**
   * An id to use for the stable React key
   */
  formReactKey: string;
  name: string;
  description?: string;
  isAsync: boolean;
  syncPolicy: SyncPolicy;
  type: JSONSchema7TypeName | "any";
};

export type ModVariableFormValues = {
  variables: ModVariable[];
};

export const SYNC_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Tab", value: "tab" },
  { label: "Session", value: "session" },
] as const;

export const TYPE_OPTIONS = [
  // JSONSchema7TypeName
  { label: "String", value: "string" },
  { label: "Number", value: "number" },
  { label: "Integer", value: "integer" },
  { label: "Boolean", value: "boolean" },
  { label: "Object", value: "object" },
  { label: "Array", value: "array" },
  { label: "Nothing", value: "null" },

  // Special types
  { label: "Any", value: "any" }, // Corresponds to `property: true` or `type: {}`
] as const;