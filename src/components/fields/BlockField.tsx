/*
 * Copyright (C) 2020 Pixie Brix, LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import React, { useMemo, useState } from "react";
import genericOptionsFactory, { BlockOptionProps } from "./blockOptions";
import cx from "classnames";
import { Form, Row, Col } from "react-bootstrap";
import { castArray, isEmpty } from "lodash";
import { FieldProps } from "@/components/fields/propTypes";
import { inputProperties } from "@/helpers";
import { IBlock } from "@/core";
import ErrorBoundary from "@/components/ErrorBoundary";
import {
  FieldArray,
  useField,
  useFormikContext,
  getIn,
  Field,
  FieldInputProps,
} from "formik";
import { fieldLabel } from "@/components/fields/fieldUtils";
import blockRegistry from "@/blocks/registry";
import Card from "react-bootstrap/Card";
import { faCaretDown, faCaretRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import "./BlockField.scss";
import Button from "react-bootstrap/Button";
import useAsyncEffect from "use-async-effect";
import GridLoader from "react-spinners/GridLoader";
import { reportError } from "@/telemetry/logging";
import BlockModal from "@/components/fields/BlockModal";
import optionsRegistry from "@/components/fields/optionsRegistry";

export const SCHEMA_TYPE_TO_BLOCK_PROPERTY: { [key: string]: string } = {
  "#/definitions/renderer": "render",
  "#/definitions/effect": "effect",
  "#/definitions/reader": "read",
  "#/definitions/transformer": "transform",
  "https://app.pixiebrix.com/schemas/renderer#": "render",
  "https://app.pixiebrix.com/schemas/effect#": "effect",
  "https://app.pixiebrix.com/schemas/reader#": "read",
  "https://app.pixiebrix.com/schemas/transformer#": "transform",
  "https://app.pixiebrix.com/schemas/renderer": "render",
  "https://app.pixiebrix.com/schemas/effect": "effect",
  "https://app.pixiebrix.com/schemas/reader": "read",
  "https://app.pixiebrix.com/schemas/transformer": "transform",
};

type ConfigValue = { [key: string]: string };

interface BlockState {
  block?: IBlock | null;
  error?: string | null;
}

export function useBlockOptions(
  id: string
): [BlockState, React.FunctionComponent<BlockOptionProps>] {
  const [{ block, error }, setBlock] = useState<BlockState>({
    block: null,
    error: null,
  });

  useAsyncEffect(
    async (isMounted) => {
      setBlock({ block: null, error: null });
      try {
        const block = await blockRegistry.lookup(id);
        if (!isMounted()) return;
        setBlock({ block });
      } catch (error_) {
        reportError(error_);
        if (!isMounted()) return;
        setBlock({ error: error_.toString() });
      }
    },
    [id, setBlock]
  );

  const BlockOptions = useMemo(() => {
    if (block) {
      const registered = optionsRegistry.get(block.id);
      return (
        registered ?? genericOptionsFactory(inputProperties(block.inputSchema))
      );
    } else {
      return null;
    }
  }, [block?.id, block?.inputSchema]);

  return [{ block, error }, BlockOptions];
}

const BlockCard: React.FunctionComponent<{
  name: string;
  config: BlockConfig;
  initialCollapsed?: boolean;
  showOutputKey: boolean;
  onRemove: () => void;
}> = ({ config, name, initialCollapsed = true, showOutputKey, onRemove }) => {
  const context = useFormikContext();

  const errors = getIn(context.errors, name);
  const isValid = isEmpty(errors);
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const [{ error }, BlockOptions] = useBlockOptions(config.id);

  return (
    <Card className={cx("BlockCard", { invalid: !isValid })}>
      <Card.Header className={cx({ "bg-danger": !isValid })}>
        <div
          onClick={() => setCollapsed(!collapsed)}
          style={{ cursor: "pointer" }}
          className="d-flex"
        >
          <div>
            <FontAwesomeIcon icon={collapsed ? faCaretRight : faCaretDown} />{" "}
            {config.id}
          </div>
          <div className="ml-auto">
            {config.outputKey && (
              <code className={cx({ "text-white": !isValid })}>
                @{config.outputKey}
              </code>
            )}
          </div>
        </div>
      </Card.Header>
      {!collapsed && (
        <Card.Body>
          {errors?.id && (
            <div className="invalid-feedback d-block mb-4">
              Unknown block {config.id}
            </div>
          )}
          {BlockOptions ? (
            <BlockOptions
              name={name}
              configKey="config"
              showOutputKey={showOutputKey}
            />
          ) : error ? (
            <div className="invalid-feedback d-block mb-4">{error}</div>
          ) : (
            <GridLoader />
          )}

          <div className="d-flex">
            <div>
              <Button variant="danger" onClick={onRemove}>
                Remove Block
              </Button>
            </div>
            <div className="mx-3 my-auto">
              <span className="my-auto">Template Engine</span>
            </div>
            <div>
              <Field name={`${name}.templateEngine`}>
                {({ field }: { field: FieldInputProps<string> }) => (
                  <Form.Control as="select" {...field}>
                    <option value="mustache">Mustache</option>
                    <option value="handlebars">Handlebars</option>
                    <option value="nunjucks">Nunjucks</option>
                  </Form.Control>
                )}
              </Field>
            </div>
          </div>
        </Card.Body>
      )}
    </Card>
  );
};

interface BlockConfig {
  id: string;
  // optionally, a name to store the output to
  outputKey?: string;
  config: ConfigValue;
  templateEngine?: "mustache" | "handlebars" | "nunjucks";
}

interface ExtraProps {
  blocks: IBlock[];
}

function makeKey(blockId: string, index: number): string {
  return `${index}-${blockId}`;
}

const BlockField: React.FunctionComponent<
  FieldProps<BlockConfig | BlockConfig[]> & ExtraProps
> = ({ label, blocks, ...props }) => {
  const [field, meta] = useField(props);

  const pipeline = useMemo(() => castArray(field.value ?? []), [field.value]);

  const numBlocks = pipeline.length;

  const [added, setAdded] = useState(null);

  return (
    <Form.Group as={Row} controlId={field.name}>
      <Form.Label column sm="2">
        {label ?? fieldLabel(field.name)}
      </Form.Label>
      <Col sm="10">
        <FieldArray name={field.name}>
          {({ remove, push }) => (
            <div>
              {pipeline.length > 0 && (
                <div className="mb-3">
                  {pipeline.map((blockConfig, index) => (
                    <ErrorBoundary key={makeKey(blockConfig.id, index)}>
                      <BlockCard
                        name={
                          Array.isArray(field.value)
                            ? `${field.name}.${index}`
                            : field.name
                        }
                        initialCollapsed={
                          added !== makeKey(blockConfig.id, index)
                        }
                        config={blockConfig}
                        showOutputKey={index < numBlocks - 1}
                        onRemove={() => remove(index)}
                      />
                    </ErrorBoundary>
                  ))}
                </div>
              )}

              <div style={{ width: 300 }} className="">
                <BlockModal
                  blocks={blocks}
                  onSelect={(x: IBlock) => {
                    setAdded(makeKey(x.id, pipeline.length));
                    push({ id: x.id, config: {} });
                  }}
                  caption="Add a block"
                />
                {typeof meta.error === "string" && (
                  <div style={{ color: "#dc3545" }}>
                    <small>{meta.error}</small>
                  </div>
                )}
              </div>
            </div>
          )}
        </FieldArray>
      </Col>
    </Form.Group>
  );
};

export default BlockField;
