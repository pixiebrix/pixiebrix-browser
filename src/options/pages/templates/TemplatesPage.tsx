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

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { RecipeDefinition } from "@/types/definitions";
import { PageTitle } from "@/layout/Page";
import { groupBy, sortBy, noop, compact } from "lodash";
import {
  faClipboardCheck,
  faExternalLinkAlt,
  faInfoCircle,
} from "@fortawesome/free-solid-svg-icons";
import {
  Button,
  Card,
  Col,
  Form,
  InputGroup,
  ListGroup,
  Row,
} from "react-bootstrap";
import { InstallRecipe, RecipeList } from "@/pages/marketplace/MarketplacePage";
import { connect } from "react-redux";
import { push } from "connected-react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import cx from "classnames";
import "./TemplatesPage.scss";
import AuthContext from "@/auth/AuthContext";
import GridLoader from "react-spinners/GridLoader";
import { useTitle } from "@/hooks/title";
import { RegistryId } from "@/core";
import { selectExtensions } from "@/options/selectors";
import { OptionsState } from "@/store/extensions";
import useFetch from "@/hooks/useFetch";

interface TemplatesProps {
  installedRecipes: Set<RegistryId>;
  installRecipe: InstallRecipe;
}

interface FeaturedRecipeDefinition extends RecipeDefinition {
  feature: {
    featured: true;
    shortName: string;
    categoryPrimary: string;
    categorySecondary: string;
  };
}

interface GroupProps {
  install: InstallRecipe;
  installedRecipes: Set<RegistryId>;
  query: string;
  group: {
    label: string;
    templates: FeaturedRecipeDefinition[];
  };
}

const CATEGORY_SORT_ORDER = new Map<string, number>([
  ["Information", 1],
  ["Social", 2],
  ["Shopping", 3],
  ["Entertainment", 4],
]);

const TemplateGroup: React.FunctionComponent<GroupProps> = ({
  query,
  install,
  installedRecipes,
  group: { label, templates },
}) => {
  const filtered = useMemo(() => {
    const normalizeQuery = (query ?? "").trim().toLowerCase();
    const matches =
      normalizeQuery === ""
        ? templates
        : templates.filter((x) =>
            (x.feature.shortName ?? x.metadata.name)
              .toLowerCase()
              .includes(normalizeQuery)
          );
    return sortBy(matches, (x) => x.feature.shortName ?? x.metadata.name);
  }, [query, templates]);

  return (
    <Col md={4} lg={3} sm={6} xl={3} className="mt-2">
      <Card>
        <Card.Header className="text-center">{label}</Card.Header>
        <ListGroup variant="flush">
          {filtered.map((recipe) => (
            <TemplateEntry
              key={recipe.metadata.id}
              installed={installedRecipes.has(recipe.metadata.id)}
              onAdd={async () => install(recipe)}
              {...recipe}
            />
          ))}
          {filtered.length === 0 && (
            <ListGroup.Item>
              <span className="text-muted">No templates found</span>
            </ListGroup.Item>
          )}
        </ListGroup>
      </Card>
    </Col>
  );
};

const TemplateEntry: React.FunctionComponent<
  FeaturedRecipeDefinition & { installed: boolean; onAdd: () => void }
> = ({ feature, metadata, installed, onAdd }) => (
  <ListGroup.Item className="TemplateEntry">
    <div className="d-flex align-items-center">
      <div>
        {installed ? (
          <Button size="sm" variant="info" disabled>
            Added
          </Button>
        ) : (
          <Button size="sm" variant="info" onClick={onAdd}>
            Add
          </Button>
        )}
      </div>
      <div className="ml-3">{feature.shortName ?? metadata.name}</div>
    </div>
  </ListGroup.Item>
);

const SharedWithMe: React.FunctionComponent<{
  active?: boolean;
  onSelect: () => void;
}> = ({ active, onSelect }) => (
  <Card className={cx("CategoryCard", { active })} onClick={onSelect}>
    <Card.Body>
      <div className="CategoryCard__title">Shared with Me</div>
      <div className="CategoryCard__subtitle">Custom</div>
    </Card.Body>
  </Card>
);

const Category: React.FunctionComponent<{
  active?: boolean;
  inviteOnly?: boolean;
  title: string;
  subtitle: string;
  onSelect?: () => void;
}> = ({ title, subtitle, active, inviteOnly, onSelect = noop }) => (
  <Card
    className={cx("CategoryCard", { active, inviteOnly })}
    onClick={onSelect}
  >
    <Card.Body>
      {inviteOnly && (
        <div className="ribbon">
          <span>Invite-Only</span>
        </div>
      )}
      <div className="CategoryCard__title">{title}</div>
      <div className="CategoryCard__subtitle">{subtitle}</div>
    </Card.Body>
  </Card>
);

const ContextMenuTemplates: React.FunctionComponent<{
  installedRecipes: Set<RegistryId>;
  install: InstallRecipe;
}> = ({ installedRecipes, install }) => {
  const { data: rawRecipes } = useFetch<FeaturedRecipeDefinition[]>(
    "/api/featured/recipes/?category=search"
  );

  const [query, setQuery] = useState("");

  const groupedRecipes = useMemo(() => {
    const groups = Object.entries(
      groupBy(rawRecipes ?? [], (x) => x.feature.categorySecondary)
    ).map(([label, templates]) => ({
      label,
      templates,
    }));
    return sortBy(groups, [
      (x) => CATEGORY_SORT_ORDER.get(x.label) ?? 999,
      (x) => x.label,
    ]);
  }, [rawRecipes]);

  return (
    <>
      <Row className="mt-3">
        <Col xl={9} lg={10} md={10} sm={12}>
          <Card className="CategoryInfo">
            <Card.Body>
              <Card.Title>Context Menus for Search</Card.Title>

              <Card.Text className="text-info">
                <FontAwesomeIcon icon={faInfoCircle} /> Once you activate a
                template, you&apos;ll be able to right-click on any page to
                search selected text
              </Card.Text>

              <Form>
                <InputGroup className="mb-2 mr-sm-2">
                  <InputGroup.Prepend>
                    <InputGroup.Text>Search</InputGroup.Text>
                  </InputGroup.Prepend>
                  <Form.Control
                    id="query"
                    placeholder="Start typing to filter templates"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                    }}
                  />
                </InputGroup>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="mt-2">
        {groupedRecipes.map((group) => (
          <TemplateGroup
            key={group.label}
            install={install}
            installedRecipes={installedRecipes}
            query={query}
            group={group}
          />
        ))}
      </Row>
    </>
  );
};

const SharedTemplates: React.FunctionComponent<{
  installedRecipes: Set<RegistryId>;
  install: InstallRecipe;
}> = ({ installedRecipes, install }) => {
  const { data: rawRecipes } = useFetch<RecipeDefinition[]>(
    "/api/invited/recipes/"
  );

  if (rawRecipes == null) {
    return (
      <Row className="mt-3">
        <Col xl={9} lg={10} md={10} sm={12}>
          <GridLoader />
        </Col>
      </Row>
    );
  }

  return (
    <>
      <Row className="mt-3">
        <Col xl={9} lg={10} md={10} sm={12}>
          <Card className="CategoryInfo">
            <Card.Body>
              <Card.Title>Shared Templates</Card.Title>
              {rawRecipes.length > 0 ? (
                <Card.Text className="text-info">
                  <FontAwesomeIcon icon={faInfoCircle} /> These templates have
                  been personally shared with you
                </Card.Text>
              ) : (
                <Card.Text className="text-info">
                  <FontAwesomeIcon icon={faInfoCircle} /> No templates have been
                  shared with you yet
                </Card.Text>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {rawRecipes.length > 0 && (
        <Row className="mt-3">
          <Col xl={8} lg={10} md={12}>
            <RecipeList
              installedRecipes={installedRecipes}
              installRecipe={install}
              recipes={rawRecipes}
            />
          </Col>
        </Row>
      )}
    </>
  );
};

const TemplatesPage: React.FunctionComponent<
  TemplatesProps & { navigate: (url: string) => void }
> = ({ installedRecipes, navigate }) => {
  useTitle("Templates");

  const { flags } = useContext(AuthContext);

  const showShared = flags?.includes("templates-shared");

  const [activeKey, setActiveKey] = useState(
    showShared ? "shared" : "contextmenu-search"
  );

  useEffect(() => {
    if (showShared) {
      setActiveKey("shared");
    }
  }, [showShared]);

  const install = useCallback(
    async (x: RecipeDefinition) => {
      navigate(`templates/activate/${encodeURIComponent(x.metadata.id)}`);
    },
    [navigate]
  );

  return (
    <div className="marketplace-component">
      <PageTitle icon={faClipboardCheck} title="Templates" />
      <div className="pb-2">
        <p>
          Activate pre-made templates for you favorite web sites and apps. To
          edit them or create your own, follow our{" "}
          <a
            href="https://docs.pixiebrix.com/quick-start-guide"
            target="_blank"
            rel="noopener noreferrer"
          >
            Page Editor Quickstart <FontAwesomeIcon icon={faExternalLinkAlt} />
          </a>
        </p>
      </div>

      <Row>
        <Col>
          <div className="d-flex align-items-center">
            {flags.includes("templates-shared") && (
              <SharedWithMe
                active={activeKey === "shared"}
                onSelect={() => {
                  setActiveKey("shared");
                }}
              />
            )}
            <Category
              active={activeKey === "contextmenu-search"}
              onSelect={() => {
                setActiveKey("contextmenu-search");
              }}
              title="Context Menus"
              subtitle="Search"
            />
            <Category title="Context Menus" subtitle="Push Data" inviteOnly />
            <Category title="Buttons" subtitle="Search" inviteOnly />
            <Category title="Buttons" subtitle="Push Data" inviteOnly />
          </div>
        </Col>
      </Row>

      {activeKey === "contextmenu-search" && (
        <ContextMenuTemplates
          installedRecipes={installedRecipes}
          install={install}
        />
      )}

      {activeKey === "shared" && (
        <SharedTemplates
          installedRecipes={installedRecipes}
          install={install}
        />
      )}
    </div>
  );
};

TemplatesPage.defaultProps = {
  installedRecipes: new Set(),
};

export default connect(
  (state: { options: OptionsState }) => ({
    installedRecipes: new Set(
      compact(selectExtensions(state).map((x) => x._recipe?.id))
    ),
  }),
  { navigate: push }
)(TemplatesPage);
