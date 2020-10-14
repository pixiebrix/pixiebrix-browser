import React, { useCallback, useMemo } from "react";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import { Schema } from "@/core";
import { FieldProps } from "@/components/fields/propTypes";
import fromPairs from "lodash/fromPairs";
import Table from "react-bootstrap/Table";
import { getDefaultField } from "@/components/fields/blockOptions";
import { useField } from "formik";
import { fieldLabel } from "@/components/fields/fieldUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import produce from "immer";

interface PropertyRow {
  name: string;
  showActions?: boolean;
  readOnly: boolean;
  schema: Schema;
  onDelete: () => void;
  onRename: (newName: string) => void;
}

const CompositePropertyRow: React.FunctionComponent<PropertyRow> = ({
  name,
  schema,
  showActions,
}) => {
  const Renderer = useMemo(() => getDefaultField(schema), [schema]);
  return (
    <tr>
      <td colSpan={showActions ? 3 : 2}>
        <Renderer name={name} schema={schema} />
      </td>
    </tr>
  );
};

const ValuePropertyRow: React.FunctionComponent<PropertyRow> = ({
  readOnly,
  onDelete,
  onRename,
  showActions,
  ...props
}) => {
  const [field, meta] = useField(props);

  const updateName = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      onRename(e.target.value);
    },
    [onRename]
  );

  const parts = field.name.split(".");
  const currentProperty = parts[parts.length - 1];

  return (
    <tr>
      <td>
        <Form.Control
          type="text"
          readOnly={readOnly}
          defaultValue={currentProperty}
          onBlur={updateName}
        />
        {/* This screws up the column width */}
        {/*{schema.description && (*/}
        {/*    <Form.Text className="text-muted">{schema.description}</Form.Text>*/}
        {/*)}*/}
      </td>
      <td>
        <Form.Control
          type="text"
          value={field.value ?? ""}
          {...field}
          isInvalid={!!meta.error}
        />
      </td>
      {showActions && (
        <td>
          {onDelete && (
            <Button variant="danger" onClick={onDelete}>
              <FontAwesomeIcon icon={faTrash} />
            </Button>
          )}
        </td>
      )}
    </tr>
  );
};

function newPropertyName(obj: { [key: string]: unknown }) {
  let x = 1;
  while (Object.prototype.hasOwnProperty.call(obj, `property${x}`)) {
    x++;
  }
  return `property${x}`;
}

interface RowProps {
  parentSchema: Schema;
  name: string;
  property: string;
  defined: boolean;
  onDelete: (prop: string) => void;
  onRename: (oldProp: string, newProp: string) => void;
}

const PropertyRow: React.FunctionComponent<RowProps> = ({
  parentSchema,
  defined,
  name,
  property,
  onDelete,
  onRename,
}) => {
  const propertySchema = defined
    ? parentSchema.properties[property]
    : parentSchema.additionalProperties;

  if (typeof propertySchema === "boolean") {
    throw new Error("Expected schema not boolean");
  }

  const PropertyRow = useMemo(() => getPropertyRow(propertySchema), [
    propertySchema,
  ]);
  const deleteProp = useCallback(() => onDelete(property), [
    property,
    onDelete,
  ]);
  const renameProp = useCallback(
    (newProp: string) => onRename(property, newProp),
    [property, onRename]
  );

  return (
    <PropertyRow
      key={property}
      name={name}
      readOnly={!!defined}
      schema={propertySchema}
      showActions={!!parentSchema.additionalProperties}
      onDelete={!defined ? deleteProp : undefined}
      onRename={!defined ? renameProp : undefined}
    />
  );
};

export const ObjectField: React.FunctionComponent<FieldProps<unknown>> = ({
  label,
  schema,
  ...props
}) => {
  const [field, , helpers] = useField(props);

  const [properties, declaredProperties] = useMemo(() => {
    const declared = schema.properties ?? {};
    const additional = fromPairs(
      Object.entries(field.value ?? {}).filter(([x]) => !declared[x])
    );
    return [[...Object.keys(declared), ...Object.keys(additional)], declared];
  }, [field.value, schema.properties]);

  const onDelete = useCallback(
    (property: string) => {
      helpers.setValue(
        produce(field.value, (draft: any) => {
          delete draft[property];
        })
      );
    },
    [helpers, field.value]
  );

  const onRename = useCallback(
    (oldProp: string, newProp: string) => {
      if (oldProp !== newProp) {
        helpers.setValue(
          produce(field.value, (draft: any) => {
            console.debug("rename", {
              object: field.value,
              value: draft[oldProp],
            });
            draft[newProp] = draft[oldProp];
            delete draft[oldProp];
          })
        );
      }
    },
    [helpers, field.value]
  );

  return (
    <Form.Group controlId={field.name}>
      <Form.Label>{label ?? fieldLabel(field.name)}</Form.Label>
      <Table size="sm">
        <thead>
          <tr>
            <th scope="col">Property</th>
            <th scope="col">Value</th>
            {schema.additionalProperties && <th scope="col">Action</th>}
          </tr>
        </thead>
        <tbody>
          {properties.map((property) => (
            <PropertyRow
              key={property}
              parentSchema={schema}
              name={`${field.name}.${property}`}
              property={property}
              defined={Object.prototype.hasOwnProperty.call(
                declaredProperties,
                property
              )}
              onDelete={onDelete}
              onRename={onRename}
            />
          ))}
        </tbody>
      </Table>
      {schema.additionalProperties && (
        <Button
          onClick={() => {
            if (field.value) {
              helpers.setValue(
                produce(field.value, (draft: any) => {
                  draft[newPropertyName(draft)] = "";
                })
              );
            } else {
              helpers.setValue({ [newPropertyName({})]: "" });
            }
          }}
        >
          Add Property
        </Button>
      )}
    </Form.Group>
  );
};

export function getPropertyRow(
  schema: Schema
): React.FunctionComponent<PropertyRow> {
  switch (schema.type) {
    case "array":
    case "object":
      return CompositePropertyRow;
    default: {
      return ValuePropertyRow;
    }
  }
}
