/*
 * Copyright (C) 2022 PixieBrix, Inc.
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

import React, { useState } from "react";
import FieldRuntimeContext, {
  RuntimeContext,
} from "@/components/fields/schemaFields/FieldRuntimeContext";
import { Col, Container, Nav, Row, Tab } from "react-bootstrap";
import Loader from "@/components/Loader";
import { isEmpty } from "lodash";
import styles from "./RecipeOptions.module.scss";
import ErrorBoundary from "@/components/ErrorBoundary";
import FormEditor from "@/components/formBuilder/FormEditor";
import dataPanelStyles from "@/devTools/editor/tabs/dataPanelTabs.module.scss";
import cx from "classnames";
import FormPreview from "@/components/formBuilder/FormPreview";
import { RJSFSchema } from "@/components/formBuilder/formBuilderTypes";
import { FIELD_TYPE_OPTIONS } from "@/components/formBuilder/formBuilderHelpers";
import { useSelector } from "react-redux";
import { selectActiveRecipeId } from "@/devTools/editor/slices/editorSelectors";
import { PAGE_EDITOR_DEFAULT_BRICK_API_VERSION } from "@/devTools/editor/extensionPoints/base";
import { useGetRecipesQuery } from "@/services/api";
import { Formik } from "formik";

const fieldTypes = FIELD_TYPE_OPTIONS.filter(
  (type) => !["File", "Image crop"].includes(type.label)
);

const formRuntimeContext: RuntimeContext = {
  apiVersion: PAGE_EDITOR_DEFAULT_BRICK_API_VERSION,
  allowExpressions: false,
};

const RecipeOptions: React.VoidFunctionComponent = () => {
  const [activeField, setActiveField] = useState<string>();
  const recipeId = useSelector(selectActiveRecipeId);
  const { data: recipes } = useGetRecipesQuery();
  const recipe = recipes?.find((recipe) => recipe.metadata.id === recipeId);

  if (recipe.options == null) {
    return (
      <Container>
        <Row>
          <Col>
            <Loader />
          </Col>
        </Row>
      </Container>
    );
  }

  const noOptions = isEmpty(recipe.options?.schema?.properties);

  return (
    <div className={styles.paneContent}>
      <ErrorBoundary>
        <Formik
          initialValues={{ optionsDefinition: recipe.options }}
          onSubmit={(values) => {
            // eslint-disable-next-line no-alert
            window.alert(`Submitted! with values: ${JSON.stringify(values)}`);
          }}
        >
          {({ values }) => (
            <>
              <div className={styles.configPanel}>
                <h5 className="mb-3">
                  Editing Options for Blueprint &quot;{recipe.metadata.name}
                  &quot;
                </h5>

                {noOptions && (
                  <div className="mb-3">
                    No options defined for this Blueprint
                  </div>
                )}

                <FieldRuntimeContext.Provider value={formRuntimeContext}>
                  <FormEditor
                    name="optionsDefinition"
                    showFormTitle={false}
                    activeField={activeField}
                    setActiveField={setActiveField}
                    fieldTypes={fieldTypes}
                  />
                </FieldRuntimeContext.Provider>
              </div>
              <div className={styles.dataPanel}>
                <Tab.Container activeKey="preview">
                  <div className={dataPanelStyles.tabContainer}>
                    <Nav variant="tabs">
                      <Nav.Item className={dataPanelStyles.tabNav}>
                        <Nav.Link eventKey="preview">Preview</Nav.Link>
                      </Nav.Item>
                    </Nav>

                    <Tab.Content className={dataPanelStyles.tabContent}>
                      <Tab.Pane
                        eventKey="preview"
                        className={cx(
                          dataPanelStyles.tabPane,
                          dataPanelStyles.selectablePreviewContainer
                        )}
                      >
                        <ErrorBoundary>
                          <FormPreview
                            rjsfSchema={values.optionsDefinition as RJSFSchema}
                            activeField={activeField}
                            setActiveField={setActiveField}
                          />
                        </ErrorBoundary>
                      </Tab.Pane>
                    </Tab.Content>
                  </div>
                </Tab.Container>
              </div>
            </>
          )}
        </Formik>
      </ErrorBoundary>
    </div>
  );
};

export default RecipeOptions;
