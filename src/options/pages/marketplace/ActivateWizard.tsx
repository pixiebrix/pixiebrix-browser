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

import styles from "./ActivateWizard.module.scss";

import React, { useEffect } from "react";
import { RecipeDefinition } from "@/types/definitions";
import { Card, Col, Form, Row } from "react-bootstrap";
import { truncate } from "lodash";
import { Formik } from "formik";
import { useTitle } from "@/hooks/title";
import useInstall from "@/options/pages/blueprints/utils/useInstall";
import { useLocation } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { selectExtensions } from "@/store/extensionsSelectors";
import { push } from "connected-react-router";
import useWizard from "@/options/pages/marketplace/useWizard";
import ActivateButton from "@/options/pages/marketplace/ActivateButton";
import useInstallableViewItems from "@/options/pages/blueprints/useInstallableViewItems";

interface OwnProps {
  blueprint: RecipeDefinition;
}

const ActivateHeader: React.FunctionComponent<{
  blueprint: RecipeDefinition;
}> = ({ blueprint }) => {
  const { installableViewItems } = useInstallableViewItems([blueprint]);

  const installableViewItem = installableViewItems[0];

  return (
    <Card.Header className={styles.wizardHeader}>
      <Row>
        <Col>
          <div className={styles.wizardBlueprintDescription}>
            <div className={styles.wizardMainInfo}>
              <span className={styles.blueprintIcon}>
                {installableViewItem.icon}
              </span>
              <span>
                <Card.Title>{installableViewItem.name}</Card.Title>
                <code className={styles.packageId}>
                  {installableViewItem.sharing.packageId}
                </code>
              </span>
            </div>
            <div>{installableViewItem.description}</div>
          </div>
          <div className={styles.activateButtonContainer}>
            <ActivateButton blueprint={blueprint} />
          </div>
        </Col>
      </Row>
    </Card.Header>
  );
};

const ActivateWizard: React.FunctionComponent<OwnProps> = ({ blueprint }) => {
  const dispatch = useDispatch();
  const location = useLocation();
  const reinstall =
    new URLSearchParams(location.search).get("reinstall") === "1";
  const [blueprintSteps, initialValues] = useWizard(blueprint);
  const install = useInstall(blueprint);

  const installedExtensions = useSelector(selectExtensions);

  // Redirect to reinstall page if the user already has the blueprint installed
  useEffect(() => {
    if (
      !reinstall &&
      installedExtensions.some((x) => x._recipe?.id === blueprint.metadata.id)
    ) {
      dispatch(
        push(
          `/marketplace/activate/${encodeURIComponent(
            blueprint.metadata.id
          )}?reinstall=1`
        )
      );
    }
  }, [dispatch, reinstall, installedExtensions, blueprint.metadata.id]);

  const action = reinstall ? "Reactivate" : "Activate";
  useTitle(`${action} ${truncate(blueprint.metadata.name, { length: 15 })}`);

  return (
    <Formik initialValues={initialValues} onSubmit={install}>
      {({ handleSubmit }) => (
        <Form
          id="activate-wizard"
          noValidate
          onSubmit={handleSubmit}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              (event.nativeEvent.target as HTMLElement).tagName !== "TEXTAREA"
            ) {
              // Don't submit form on "enter" key. Only submit on using "Activate" button
              event.preventDefault();
              return false;
            }
          }}
        >
          <Card>
            <ActivateHeader blueprint={blueprint} />
            <Card.Body className={styles.wizardBody}>
              {blueprintSteps.map(({ Component, label, key }, _) => (
                <Row key={key} className={styles.wizardBodyRow}>
                  <Col xs={12}>
                    <h4>{label}</h4>
                  </Col>
                  <Component blueprint={blueprint} reinstall={reinstall} />
                </Row>
              ))}
            </Card.Body>
          </Card>
        </Form>
      )}
    </Formik>
  );
};

export default ActivateWizard;
