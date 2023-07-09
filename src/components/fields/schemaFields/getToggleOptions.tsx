import React from "react";
import { isEmpty, sortBy } from "lodash";
import { getOptionForInputMode } from "./widgets/TemplateToggleWidget";
import {
  type InputModeOption,
  type OmitOption,
  type StringOption,
} from "./widgets/templateToggleWidgetTypes";
import { isTemplateExpression } from "@/runtime/mapArgs";
import { type UnknownObject } from "@/types/objectTypes";
import OptionIcon from "./optionIcon/OptionIcon";
import widgetsRegistry from "./widgets/widgetsRegistry";
import { type CustomFieldToggleMode } from "@/components/fields/schemaFields/schemaFieldTypes";
import {
  isDatabaseField,
  isGoogleSheetIdField,
  isIconField,
  isKeyStringField,
  isLabelledEnumField,
  isSelectField,
  isSimpleServiceField,
} from "./fieldTypeCheckers";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCloud } from "@fortawesome/free-solid-svg-icons";
import { faFileAlt } from "@fortawesome/free-regular-svg-icons";
import { ServiceFieldDescription } from "@/components/fields/schemaFields/ServiceField";
import { isCustomizableObjectSchema } from "@/components/fields/schemaFields/widgets/widgetUtils";
import { type Schema } from "@/types/schemaTypes";
import { type ExpressionType } from "@/types/runtimeTypes";

type ToggleOptionInputs = {
  fieldSchema: Schema;
  isRequired: boolean;
  customToggleModes: CustomFieldToggleMode[];
  isObjectProperty: boolean;
  isArrayItem: boolean;
  allowExpressions: boolean;
};

// TODO refactor this function to be more readable (complexity of 28)
// eslint-disable-next-line complexity
export function getToggleOptions({
  fieldSchema,
  isRequired,
  customToggleModes,
  isObjectProperty,
  isArrayItem,
  allowExpressions,
}: ToggleOptionInputs): InputModeOption[] {
  const textOption: StringOption = {
    label: "Text",
    value: "string",
    symbol: <OptionIcon icon="text" />,
    Widget: widgetsRegistry.TextWidget,
    interpretValue(oldValue: unknown) {
      let newValue =
        typeof fieldSchema.default === "string" ? fieldSchema.default : "";
      if (typeof oldValue === "string" && oldValue.length > 0) {
        newValue = oldValue;
      } else if (typeof oldValue === "number" && oldValue > 0) {
        newValue = String(oldValue);
      } else if (
        isTemplateExpression(oldValue) &&
        oldValue.__value__.length > 0
      ) {
        newValue = oldValue.__value__;
      }

      return allowExpressions
        ? {
            // Cast as ExpressionType because without it there's a type error compiling in the app project. (Because
            // TypeScript treats the return value as string and doesn't unify it with unknown)
            __type__: "nunjucks" as ExpressionType,
            __value__: newValue,
          }
        : newValue;
    },
  };

  let options: InputModeOption[] = [];

  function pushOptions(...newOptions: InputModeOption[]) {
    for (const newOption of newOptions) {
      const existingOption = getOptionForInputMode(options, newOption.value);

      if (!existingOption) {
        options.push(newOption);
      } else if (
        existingOption.value !== "omit" &&
        existingOption.label === newOption.label
      ) {
        // Handle the case where the field supports anyOf/oneOf where the sub-schemas have different documentation.
        options = options.filter((x) => x.value !== newOption.value);
        options.push({
          ...existingOption,
          description: "Multiple input data types supported",
        });
      }
    }
  }

  function handleOptionalValue() {
    if (isRequired) {
      return;
    }

    const omitOption: OmitOption = {
      label: isArrayItem ? "Remove" : "Exclude",
      value: "omit",
      symbol: <OptionIcon icon="exclude" />,
      Widget: widgetsRegistry.OmitFieldWidget,
    };

    pushOptions(omitOption);
  }

  function handleVarOption() {
    if (allowExpressions) {
      const varOption: StringOption = {
        label: "Variable",
        value: "var",
        symbol: <OptionIcon icon="variable" />,
        Widget: widgetsRegistry.TextWidget,
        interpretValue(oldValue: unknown) {
          let newValue = "";
          if (typeof oldValue === "string") {
            newValue = oldValue;
          } else if (typeof oldValue === "number" && oldValue > 0) {
            newValue = String(oldValue);
          } else if (isTemplateExpression(oldValue)) {
            newValue = oldValue.__value__;
          }

          return {
            // Cast as ExpressionType because without it there's a type error compiling in the app project. (Because
            // TypeScript treats the return value as string and doesn't unify it with unknown)
            __type__: "var" as ExpressionType,
            __value__: newValue,
          };
        },
      };
      pushOptions(varOption);
    }
  }

  for (const mode of customToggleModes) {
    // eslint-disable-next-line unicorn/prefer-regexp-test -- ?? not using String.match()
    if (mode.match(fieldSchema)) {
      pushOptions(mode.option);
    }
  }

  if (isKeyStringField(fieldSchema)) {
    pushOptions({
      label: "Key",
      value: "string",
      symbol: <OptionIcon icon="key" />,
      interpretValue: (value: unknown) => (value ? String(value) : ""),
      Widget: widgetsRegistry.PasswordWidget,
    });
    handleOptionalValue();
    return options;
  }

  if (isDatabaseField(fieldSchema)) {
    pushOptions({
      label: "Database",
      value: "select",
      symbol: <OptionIcon icon="select" />,
      Widget: widgetsRegistry.DatabaseWidget,
      interpretValue: () =>
        typeof fieldSchema.default === "string"
          ? String(fieldSchema.default)
          : null,
    });

    handleVarOption();
    handleOptionalValue();

    return options;
  }

  if (isIconField(fieldSchema)) {
    pushOptions({
      label: "Icon",
      value: "select",
      symbol: <OptionIcon icon="select" />,
      Widget: widgetsRegistry.IconWidget,
      interpretValue: () => null,
    });

    handleVarOption();
    handleOptionalValue();

    return options;
  }

  // Let the multi-schema handling do its thing, don't check here
  if (isSimpleServiceField(fieldSchema)) {
    pushOptions({
      label: "Integration",
      value: "select",
      symbol: <FontAwesomeIcon icon={faCloud} fixedWidth />,
      Widget: widgetsRegistry.ServiceWidget,
      description: <ServiceFieldDescription schema={fieldSchema} />,
      interpretValue: () => null, // ServiceWidget has logic that will make this null anyway
    });
    handleOptionalValue();
    return options;
  }

  if (isGoogleSheetIdField(fieldSchema)) {
    pushOptions({
      label: "Sheet",
      value: "string",
      symbol: <FontAwesomeIcon icon={faFileAlt} fixedWidth />,
      Widget: widgetsRegistry.SheetsFileWidget,
      interpretValue: () => "",
    });
    handleVarOption();
    handleOptionalValue();
    return options;
  }

  // Labelled enum fields are handled by isSelectFieldCheck
  const multiSchemas = isLabelledEnumField(fieldSchema)
    ? []
    : [
        ...(fieldSchema.anyOf ?? []),
        ...(fieldSchema.oneOf ?? []),
        ...(fieldSchema.allOf ?? []),
      ];

  const anyType = isEmpty(multiSchemas) && !fieldSchema.type;

  if (Array.isArray(fieldSchema.type)) {
    const { type: typeArray, ...rest } = fieldSchema;
    for (const type of typeArray) {
      const optionSet = getToggleOptions({
        fieldSchema: { type, ...rest },
        isRequired,
        customToggleModes,
        isObjectProperty,
        isArrayItem,
        allowExpressions,
      });
      pushOptions(...optionSet);
    }
  }

  if (fieldSchema.type === "array" || anyType) {
    // Don't allow editing array fields nested inside objects/arrays
    const Widget =
      isObjectProperty || isArrayItem
        ? widgetsRegistry.WorkshopMessageWidget
        : widgetsRegistry.ArrayWidget;
    pushOptions({
      label: "Array items",
      value: "array",
      symbol: <OptionIcon icon="array" />,
      Widget,
      interpretValue: () =>
        Array.isArray(fieldSchema.default) ? fieldSchema.default : [],
    });
    handleVarOption();
  }

  if (
    fieldSchema.type === "object" ||
    anyType ||
    // An empty field schema supports any value. For now, provide an object field since this just shows up
    // in the @pixiebrix/http brick.
    // https://github.com/pixiebrix/pixiebrix-extension/issues/709
    isEmpty(fieldSchema)
  ) {
    const custom = isCustomizableObjectSchema(fieldSchema);

    // Don't allow editing objects inside other objects
    const Widget = isObjectProperty
      ? custom
        ? widgetsRegistry.WorkshopMessageWidget
        : widgetsRegistry.FixedInnerObjectWidget
      : widgetsRegistry.ObjectWidget;
    pushOptions({
      label:
        Widget === widgetsRegistry.FixedInnerObjectWidget
          ? "Advanced properties"
          : "Object properties",
      value: "object",
      symbol: <OptionIcon icon="object" />,
      Widget,
      interpretValue: () =>
        (typeof fieldSchema.default === "object"
          ? fieldSchema.default
          : {}) as UnknownObject,
    });
    handleVarOption();
  }

  if (fieldSchema.type === "boolean" || anyType) {
    pushOptions({
      label: "Toggle",
      value: "boolean",
      symbol: <OptionIcon icon="toggle" />,
      Widget: widgetsRegistry.BooleanWidget,
      interpretValue: () =>
        typeof fieldSchema.default === "boolean" ? fieldSchema.default : false,
    });
    handleVarOption();
  }

  if (isSelectField(fieldSchema)) {
    pushOptions({
      label: "Select...",
      value: "select",
      symbol: <OptionIcon icon="select" />,
      Widget: widgetsRegistry.SchemaSelectWidget,
      interpretValue: () =>
        typeof fieldSchema.default === "string"
          ? String(fieldSchema.default)
          : null,
    });
  }

  // Select fields will match the basic string check also
  if (fieldSchema.type === "string" || anyType) {
    pushOptions(textOption);
    handleVarOption();
  }

  // Don't include integer for "anyType", only include number, which can also accept integers
  if (fieldSchema.type === "integer") {
    pushOptions({
      label: "Whole number",
      value: "number",
      symbol: <OptionIcon icon="number" />,
      Widget: widgetsRegistry.IntegerWidget,
      interpretValue(oldValue: unknown) {
        let int = Number.NaN;
        if (typeof oldValue === "string") {
          int = Number.parseInt(oldValue, 10);
        }

        if (isTemplateExpression(oldValue)) {
          int = Number.parseInt(oldValue.__value__, 10);
        }

        if (!Number.isNaN(int)) {
          return int;
        }

        return typeof fieldSchema.default === "number"
          ? fieldSchema.default
          : 0;
      },
    });
    handleVarOption();
  }

  if (fieldSchema.type === "number" || anyType) {
    pushOptions({
      label: "Number",
      value: "number",
      symbol: <OptionIcon icon="number" />,
      Widget: widgetsRegistry.NumberWidget,
      interpretValue(oldValue: unknown) {
        let float = Number.NaN;
        if (typeof oldValue === "string") {
          float = Number.parseFloat(oldValue);
        }

        if (isTemplateExpression(oldValue)) {
          float = Number.parseFloat(oldValue.__value__);
        }

        if (!Number.isNaN(float)) {
          return float;
        }

        return typeof fieldSchema.default === "number"
          ? fieldSchema.default
          : 0;
      },
    });
    handleVarOption();
  }

  const multiOptions = multiSchemas.flatMap((subSchema) => {
    if (typeof subSchema === "boolean") {
      return [];
    }

    return getToggleOptions({
      fieldSchema: subSchema,
      isRequired,
      customToggleModes,
      isObjectProperty,
      isArrayItem,
      allowExpressions,
    }).map((option) => {
      // Only use the schema description if a custom description wasn't already
      // set for the input mode option
      if (!option.description) {
        option.description = subSchema.description;
      }

      return option;
    });
  });
  if (!isEmpty(multiOptions)) {
    pushOptions(...multiOptions);
  }

  handleOptionalValue();

  return sortBy(options, (opt: InputModeOption) => opt.value === "omit");
}
