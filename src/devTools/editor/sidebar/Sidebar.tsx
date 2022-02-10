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

import browser from "webextension-polyfill";
import React, { FormEvent, useContext, useMemo, useState } from "react";
import { FormState } from "@/devTools/editor/slices/editorSlice";
import { DevToolsContext } from "@/devTools/context";
import { sortBy } from "lodash";
import { sleep } from "@/utils";
import {
  Badge,
  Button,
  Dropdown,
  DropdownButton,
  Form,
  ListGroup,
} from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IExtension, UUID } from "@/core";
import { ADAPTERS } from "@/devTools/editor/extensionPoints/adapter";
import hash from "object-hash";
import logoUrl from "@/icons/custom-icons/favicon.svg";
import { IconProp } from "@fortawesome/fontawesome-svg-core";
import useInstallState from "@/devTools/editor/hooks/useInstallState";
import InstalledEntry from "@/devTools/editor/sidebar/InstalledEntry";
import DynamicEntry from "@/devTools/editor/sidebar/DynamicEntry";
import { isExtension } from "@/devTools/editor/sidebar/common";
import useAddElement from "@/devTools/editor/hooks/useAddElement";
import Footer from "@/devTools/editor/sidebar/Footer";
import styles from "./Sidebar.module.scss";
import {
  faAngleDoubleLeft,
  faAngleDoubleRight,
  faSync,
} from "@fortawesome/free-solid-svg-icons";
import { CSSTransition } from "react-transition-group";
import cx from "classnames";
import { CSSTransitionProps } from "react-transition-group/CSSTransition";
import { RecipeDefinition } from "@/types/definitions";
import { GridLoader } from "react-spinners";
import useFlags from "@/hooks/useFlags";

const ReloadButton: React.VoidFunctionComponent = () => (
  <Button
    type="button"
    size="sm"
    variant="light"
    title="Shift-click to attempt to reload all contexts (in 2 seconds)"
    className="mt-auto"
    onClick={async (event) => {
      if (event.shiftKey) {
        browser.runtime?.reload(); // Not guaranteed
        await browser.tabs.reload(browser.devtools.inspectedWindow.tabId);

        // We must wait before reloading or else the loading fails
        // https://github.com/pixiebrix/pixiebrix-extension/pull/2381
        await sleep(2000);
      }

      location.reload();
    }}
  >
    <FontAwesomeIcon icon={faSync} />
  </Button>
);
const DropdownEntry: React.VoidFunctionComponent<{
  caption: string;
  icon: IconProp;
  onClick: () => void;
  beta?: boolean;
}> = ({ beta, icon, caption, onClick }) => (
  <Dropdown.Item onClick={onClick}>
    <FontAwesomeIcon icon={icon} />
    &nbsp;{caption}
    {beta && (
      <>
        {" "}
        <Badge variant="success" pill>
          Beta
        </Badge>
      </>
    )}
  </Dropdown.Item>
);

const Logo: React.VoidFunctionComponent = () => (
  <img src={logoUrl} alt="PixiBrix logo" className={styles.logo} />
);

type SidebarProps = {
  isInsertingElement: boolean;
  activeElementId: UUID | null;
  readonly elements: FormState[];
  installed: IExtension[];
  recipes: RecipeDefinition[];
  isLoadingItems: boolean;
};

const SidebarExpanded: React.VoidFunctionComponent<
  SidebarProps & {
    collapseSidebar: () => void;
  }
> = ({
  isInsertingElement,
  activeElementId,
  installed,
  elements,
  recipes,
  isLoadingItems,
  collapseSidebar,
}) => {
  const context = useContext(DevToolsContext);

  const { flagOn } = useFlags();
  const showDeveloperUI =
    process.env.ENVIRONMENT === "development" ||
    flagOn("page-editor-developer");
  const showBetaExtensionPoints = flagOn("page-editor-beta");

  const {
    tabState: { hasPermissions },
  } = context;

  const [showAll, setShowAll] = useState(false);

  const {
    availableInstalledIds,
    availableDynamicIds,
    unavailableCount,
  } = useInstallState(installed, elements);

  const elementHash = hash(
    sortBy(elements.map((formState) => `${formState.uuid}-${formState.label}`))
  );
  const entries = useMemo(
    () => {
      const elementIds = new Set(elements.map((formState) => formState.uuid));
      const entries = [
        ...elements.filter(
          (formState) =>
            showAll ||
            availableDynamicIds?.has(formState.uuid) ||
            activeElementId === formState.uuid
        ),
        ...installed.filter(
          (extension) =>
            !elementIds.has(extension.id) &&
            (showAll || availableInstalledIds?.has(extension.id))
        ),
      ];
      return sortBy(entries, (x) => x.label);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- using elementHash to track element changes
    [
      installed,
      elementHash,
      availableDynamicIds,
      showAll,
      availableInstalledIds,
      activeElementId,
    ]
  );

  const addElement = useAddElement();

  return (
    <div className={cx(styles.root, styles.expanded)}>
      <div>
        <div className={styles.actions}>
          <div className={styles.actionsLeft}>
            <a
              href="/options.html"
              target="_blank"
              title="Open PixieBrix Options"
            >
              <Logo />
            </a>
            <DropdownButton
              disabled={isInsertingElement || !hasPermissions}
              variant="info"
              size="sm"
              title="Add"
              id="add-extension-point"
            >
              {sortBy([...ADAPTERS.values()], (x) => x.displayOrder)
                .filter((element) => showBetaExtensionPoints || !element.beta)
                .map((element) => (
                  <DropdownEntry
                    key={element.elementType}
                    caption={element.label}
                    icon={element.icon}
                    beta={element.beta}
                    onClick={() => {
                      addElement(element);
                    }}
                  />
                ))}
            </DropdownButton>

            {showDeveloperUI && <ReloadButton />}
          </div>
          <Button
            variant="light"
            className={cx(styles.toggle)}
            type="button"
            onClick={collapseSidebar}
          >
            <FontAwesomeIcon icon={faAngleDoubleLeft} />
          </Button>
        </div>

        {unavailableCount ? (
          <div className={styles.unavailable}>
            <Form.Check
              id="unavailable-extensions-checkbox"
              type="checkbox"
              label={`Show ${unavailableCount} unavailable`}
              defaultChecked={showAll}
              onChange={(event: FormEvent<HTMLInputElement>) => {
                setShowAll(event.currentTarget.checked);
              }}
            />
          </div>
        ) : null}
      </div>
      <div className={styles.extensions}>
        {isLoadingItems ? (
          <GridLoader />
        ) : (
          <ListGroup>
            {entries.map((entry) =>
              isExtension(entry) ? (
                <InstalledEntry
                  key={`installed-${entry.id}`}
                  extension={entry}
                  recipes={recipes}
                  active={activeElementId === entry.id}
                  available={
                    !availableInstalledIds ||
                    availableInstalledIds.has(entry.id)
                  }
                />
              ) : (
                <DynamicEntry
                  key={`dynamic-${entry.uuid}`}
                  item={entry}
                  active={activeElementId === entry.uuid}
                  available={
                    !availableDynamicIds || availableDynamicIds.has(entry.uuid)
                  }
                />
              )
            )}
          </ListGroup>
        )}
      </div>
      <Footer />
    </div>
  );
};

const SidebarCollapsed: React.VoidFunctionComponent<{
  expandSidebar: () => void;
}> = ({ expandSidebar }) => {
  const { flagOn } = useFlags();

  const showDeveloperUI =
    process.env.ENVIRONMENT === "development" ||
    flagOn("page-editor-developer");

  return (
    <>
      <div className={cx(styles.root, styles.collapsed)}>
        <Button
          variant="light"
          className={cx(styles.toggle)}
          type="button"
          onClick={expandSidebar}
        >
          <Logo />
          <FontAwesomeIcon icon={faAngleDoubleRight} />
        </Button>
        {showDeveloperUI && <ReloadButton />}
      </div>
    </>
  );
};

const transitionProps: CSSTransitionProps = {
  classNames: {
    enter: styles.enter,
    enterActive: styles.enterActive,
    exit: styles.exit,
    exitActive: styles.exitActive,
  },
  timeout: 500,
  unmountOnExit: true,
  mountOnEnter: true,
};

const Sidebar: React.VoidFunctionComponent<SidebarProps> = (props) => {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  return (
    <>
      <CSSTransition {...transitionProps} in={collapsed}>
        <SidebarCollapsed
          expandSidebar={() => {
            setCollapsed(false);
          }}
        />
      </CSSTransition>
      <CSSTransition {...transitionProps} in={!collapsed}>
        <SidebarExpanded
          collapseSidebar={() => {
            setCollapsed(true);
          }}
          {...props}
        />
      </CSSTransition>
    </>
  );
};

export default Sidebar;
