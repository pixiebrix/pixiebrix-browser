/*
 * Copyright (C) 2021 PixieBrix, Inc.
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

import React, { useMemo } from "react";
import { Schema } from "@/core";
import { ListGroup, Table } from "react-bootstrap";
import { isEmpty, sortBy } from "lodash";
import { useTable, useExpanded, Row, Cell } from "react-table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCaretDown,
  faCaretRight,
  faCheck,
} from "@fortawesome/free-solid-svg-icons";
import { isServiceField } from "@/components/fields/schemaFields/ServiceField";
import styles from "./SchemaTree.module.scss";

type SchemaTreeRow = {
  name: string;
  required: boolean;
  type: string;
  description: string;
  subRow?: SchemaTreeRow;
};

const ExpandableCell: React.FunctionComponent<{
  row: Row & { values: SchemaTreeRow };
  cell: Cell;
}> = ({ row, cell }) => (
  <span
    {...row.getToggleRowExpandedProps({
      style: {
        // Indent the row according to depth level
        paddingLeft: `${row.depth * 2}rem`,
      },
    })}
  >
    {row.canExpand && (
      <>
        {row.isExpanded ? (
          <FontAwesomeIcon icon={faCaretDown} className="mr-1" />
        ) : (
          <FontAwesomeIcon icon={faCaretRight} className="mr-1" />
        )}
      </>
    )}
    <code>{cell.value}</code>
  </span>
);

const CodeCell: React.FunctionComponent<{
  cell: Cell;
}> = ({ cell }) => <code>{cell.value}</code>;

const RequiredCell: React.FunctionComponent<{
  row: Row & { values: SchemaTreeRow };
}> = ({ row }) => (
  <span>
    {row.values.required && (
      <FontAwesomeIcon icon={faCheck} className="text-success" />
    )}
  </span>
);

const getFormattedType = (definition: Schema) => {
  const { type, format, oneOf, anyOf } = definition;

  if (oneOf) {
    return "one of many objects";
  }

  if (anyOf) {
    for (const field of anyOf) {
      if (isServiceField(field as Schema)) {
        return "integration";
      }
    }

    return "one or more of many objects";
  }

  if (type === "array") {
    const items = definition.items ?? { type: "unknown" };
    const itemType = ((items as Schema) ?? {}).type as string;
    return itemType ? `array of ${itemType}s` : "array";
  }

  let formatted_type = "";
  if (Array.isArray(type)) {
    for (const t of type) {
      formatted_type = `${formatted_type ? `${formatted_type}, ` : ""}${
        t as string
      }`;
    }

    formatted_type = `[${formatted_type}]`;
  }

  if (definition.enum) {
    return formatted_type ? `${formatted_type} enum` : `${type as string} enum`;
  }

  if (formatted_type) {
    return formatted_type;
  }

  if (format) {
    return `${format} ${type as string}`;
  }

  return type ? type : "unknown";
};

const getFormattedData = (schema: Schema): SchemaTreeRow[] => {
  if (schema.items) {
    // This is an array, crawl array items instead
    return getFormattedData(schema.items as Schema);
  }

  return sortBy(Object.entries(schema.properties ?? {}), (x) => x[0])
    .filter(([, definition]) => typeof definition !== "boolean")
    .map(([prop, definition]) => {
      const schemaDefinition = definition as Schema;
      const { description } = schemaDefinition;

      return {
        name: prop,
        required: schema.required ? schema.required.includes(prop) : false,
        type: getFormattedType(schemaDefinition),
        description,
        subRows: getFormattedData(schemaDefinition),
      };
    }) as SchemaTreeRow[];
};

const DescriptionCell: React.FunctionComponent<{
  cell: Cell;
}> = ({ cell }) => <p className="m-0">{cell.value}</p>;

const SchemaTree: React.FunctionComponent<{ schema: Schema }> = ({
  schema,
}) => {
  const data = useMemo(() => {
    if (!schema) {
      return [];
    }

    return getFormattedData(schema);
  }, [schema]);

  const columns = useMemo(
    () => [
      {
        id: "expander",
        Header: "Name",
        accessor: "name",
        Cell: ExpandableCell,
      },
      {
        Header: "Required",
        accessor: "required",
        Cell: RequiredCell,
      },
      {
        Header: "Type",
        accessor: "type",
        Cell: CodeCell,
      },
      {
        Header: "Description",
        accessor: "description",
        Cell: DescriptionCell,
      },
    ],
    []
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable({ columns, data }, useExpanded);

  if (!schema) {
    return (
      <ListGroup variant="flush" className="SchemaTree">
        <ListGroup.Item>No schema</ListGroup.Item>
      </ListGroup>
    );
  }

  if (isEmpty(schema.properties)) {
    return (
      <ListGroup variant="flush" className="SchemaTree">
        <ListGroup.Item>No properties defined</ListGroup.Item>
      </ListGroup>
    );
  }

  return (
    <Table {...getTableProps()}>
      <thead>
        {headerGroups.map((headerGroup) => {
          const {
            key,
            ...restHeaderGroupProps
          } = headerGroup.getHeaderGroupProps();
          return (
            <tr key={key} {...restHeaderGroupProps}>
              {headerGroup.headers.map((column) => {
                const { key, ...restColumn } = column.getHeaderProps();
                return (
                  <th key={key} {...restColumn}>
                    {column.render("Header")}
                  </th>
                );
              })}
            </tr>
          );
        })}
      </thead>
      <tbody {...getTableBodyProps}>
        {rows.map((row) => {
          prepareRow(row);
          const { key, ...restRowProps } = row.getRowProps();
          return (
            <tr key={key} {...restRowProps}>
              {row.cells.map((cell) => {
                const { key, ...restCellProps } = cell.getCellProps();
                return (
                  <td
                    key={key}
                    {...restCellProps}
                    className={styles.SchemaTree__table_cell}
                  >
                    {cell.render("Cell")}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
};

export default SchemaTree;
