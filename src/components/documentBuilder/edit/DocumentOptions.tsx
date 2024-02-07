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

import React from "react";
import { useField } from "formik";
import { type DocumentElement } from "@/components/documentBuilder/documentBuilderTypes";
import ConfigErrorBoundary from "@/pageEditor/fields/ConfigErrorBoundary";
import { joinName } from "@/utils/formUtils";
import useAsyncEffect from "use-async-effect";
import { useSelector } from "react-redux";
import { selectNodePreviewActiveElement } from "@/pageEditor/slices/editorSelectors";
import ElementEditor from "@/components/documentBuilder/edit/ElementEditor";
import { Col, Row } from "react-bootstrap";
import styles from "@/components/documentBuilder/edit/DocumentOptions.module.scss";
import ConnectedCollapsibleFieldSection from "@/pageEditor/fields/ConnectedCollapsibleFieldSection";
import SchemaField from "@/components/fields/schemaFields/SchemaField";
import { DOCUMENT_SCHEMA } from "@/bricks/renderers/document";
import { type Schema } from "@/types/schemaTypes";

const DocumentOptions: React.FC<{
  name: string;
  configKey: string;
}> = ({ name, configKey }) => {
  const documentConfigName = joinName(name, configKey);
  const documentBodyName = joinName(documentConfigName, "body");

  const activeElement = useSelector(selectNodePreviewActiveElement);

  const [{ value: bodyValue }, , { setValue: setBodyValue }] =
    useField<DocumentElement[]>(documentBodyName);

  useAsyncEffect(async () => {
    if (!Array.isArray(bodyValue)) {
      await setBodyValue([]);
    }
    // Exclude setValue because reference changes on render
  }, [bodyValue]);

  return (
    <ConfigErrorBoundary>
      {activeElement ? (
        <ElementEditor documentBodyName={documentBodyName} />
      ) : (
        <Row className={styles.currentFieldRow}>
          <Col xl="3" className={styles.currentField}>
            <h6>Nothing selected</h6>
          </Col>
          <Col xl>
            <small className="text-muted">
              Use the Preview Tab on the right to select an element to edit ⟶
            </small>
          </Col>
        </Row>
      )}
      <ConnectedCollapsibleFieldSection title={"Advanced: Theme"}>
        <SchemaField
          name={joinName(documentConfigName, "stylesheets")}
          schema={DOCUMENT_SCHEMA.properties.stylesheets as Schema}
        />
        <SchemaField
          name={joinName(documentConfigName, "disableParentStyles")}
          schema={DOCUMENT_SCHEMA.properties.disableParentStyles as Schema}
        />
      </ConnectedCollapsibleFieldSection>
    </ConfigErrorBoundary>
  );
};

export default DocumentOptions;
