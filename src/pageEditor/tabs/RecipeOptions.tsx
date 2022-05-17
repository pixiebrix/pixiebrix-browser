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

import React, { useCallback, useState } from "react";
import FieldRuntimeContext, {
  RuntimeContext,
} from "@/components/fields/schemaFields/FieldRuntimeContext";
import { Card, Col, Container, Nav, Row, Tab } from "react-bootstrap";
import Loader from "@/components/Loader";
import { isEmpty } from "lodash";
import styles from "./RecipeOptions.module.scss";
import ErrorBoundary from "@/components/ErrorBoundary";
import FormEditor from "@/components/formBuilder/edit/FormEditor";
import dataPanelStyles from "@/pageEditor/tabs/dataPanelTabs.module.scss";
import cx from "classnames";
import FormPreview from "@/components/formBuilder/preview/FormPreview";
import { RJSFSchema } from "@/components/formBuilder/formBuilderTypes";
import {
  FIELD_TYPE_OPTIONS,
  getMinimalSchema,
  getMinimalUiSchema,
} from "@/components/formBuilder/formBuilderHelpers";
import { useDispatch, useSelector } from "react-redux";
import {
  selectActiveRecipeId,
  selectDirtyOptionsForRecipeId,
} from "@/pageEditor/slices/editorSelectors";
import { PAGE_EDITOR_DEFAULT_BRICK_API_VERSION } from "@/pageEditor/extensionPoints/base";
import { useGetRecipesQuery } from "@/services/api";
import { Formik } from "formik";
import { OptionsDefinition } from "@/types/definitions";
import { actions } from "@/pageEditor/slices/editorSlice";
import Effect from "@/pageEditor/components/Effect";
import { getErrorMessage } from "@/errors";

const fieldTypes = FIELD_TYPE_OPTIONS.filter(
  (type) => !["File", "Image crop"].includes(type.label)
);

const formRuntimeContext: RuntimeContext = {
  apiVersion: PAGE_EDITOR_DEFAULT_BRICK_API_VERSION,
  allowExpressions: false,
};

const emptyOptions: OptionsDefinition = {
  schema: getMinimalSchema(),
  uiSchema: getMinimalUiSchema(),
};

const RecipeOptions: React.VFC = () => {
  const [activeField, setActiveField] = useState<string>();
  const recipeId = useSelector(selectActiveRecipeId);
  const { data: recipes, isLoading, error } = useGetRecipesQuery();
  const recipe = recipes?.find((recipe) => recipe.metadata.id === recipeId);
  const savedOptions = recipe?.options;
  const dirtyOptions = useSelector(selectDirtyOptionsForRecipeId(recipeId));

  const optionsDefinition = dirtyOptions ?? savedOptions ?? emptyOptions;

  const initialValues = { optionsDefinition };

  const dispatch = useDispatch();
  const updateRedux = useCallback(
    (options: OptionsDefinition) => {
      dispatch(actions.editRecipeOptions(options));
    },
    [dispatch]
  );

  if (isLoading || error) {
    return (
      <Container>
        <Row>
          <Col>
            {isLoading ? (
              <Loader />
            ) : (
              <div className="text-danger">{getErrorMessage(error)}</div>
            )}
          </Col>
        </Row>
      </Container>
    );
  }

  const noOptions = isEmpty(initialValues.optionsDefinition.schema.properties);

  return (
    <div className={styles.paneContent}>
      <ErrorBoundary>
        <Formik
          initialValues={initialValues}
          onSubmit={() => {
            console.error(
              "Formik's submit should not be called to save recipe options. Use 'saveRecipe' from 'useRecipeSaver' instead."
            );
          }}
        >
          {({ values }) => (
            <>
              <Effect
                values={values.optionsDefinition}
                onChange={updateRedux}
                delayMillis={100}
              />

              <div className={styles.configPanel}>
                <Card>
                  <Card.Header>Advanced: Blueprint Options</Card.Header>
                  <Card.Body>
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
                  </Card.Body>
                </Card>
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
