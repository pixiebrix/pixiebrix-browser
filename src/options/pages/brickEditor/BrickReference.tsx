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

import React, { useEffect, useMemo, useState } from "react";
import {
  Col,
  Container,
  Form,
  InputGroup,
  ListGroup,
  Row,
} from "react-bootstrap";
import { IBlock, IService } from "@/core";
import Fuse from "fuse.js";
import { sortBy } from "lodash";
import styles from "./BrickReference.module.scss";
import GridLoader from "react-spinners/GridLoader";
import { BrickDetail } from "./BrickDetail";
import { ReferenceEntry } from "./brickEditorTypes";
import { BlockResult } from "./BlockResult";
import cx from "classnames";
import { isOfficial } from "@/blocks/util";
import { useAsyncState } from "@/hooks/common";
import { find } from "@/registry/localRegistry";
import { blockConfigToYaml } from "@/utils/objToYaml";

const BrickReference: React.FunctionComponent<{
  blocks: ReferenceEntry[];
  initialSelected?: ReferenceEntry;
}> = ({ blocks, initialSelected }) => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReferenceEntry>(initialSelected);

  const sortedBlocks = useMemo(
    () =>
      sortBy(
        blocks ?? [],
        (x) => (isOfficial(x.id) ? 0 : 1),
        (x) => x.name
      ),
    [blocks]
  );

  useEffect(() => {
    if (sortedBlocks.length > 0 && selected == null) {
      setSelected(sortedBlocks[0]);
    }
  }, [sortedBlocks, selected, setSelected]);

  const [blockConfig, isBlockConfigLoading] = useAsyncState(async () => {
    if (!selected?.id) {
      return null;
    }

    const blockPackage = await find(selected.id);
    return blockPackage?.config ? blockConfigToYaml(blockPackage.config) : null;
  }, [selected]);

  const fuse: Fuse<IBlock | IService> = useMemo(
    () =>
      new Fuse(sortedBlocks, {
        // Prefer name, then id
        keys: ["name", "id"],
      }),
    [sortedBlocks]
  );

  const results = useMemo(() => {
    let matches =
      query.trim() === ""
        ? sortedBlocks
        : fuse.search(query).map((x) => x.item);

    // If a brick is selected, have it show up at the top of the list
    if (selected && selected.id === initialSelected?.id) {
      matches = [selected, ...matches.filter((x) => x.id !== selected.id)];
    }

    return matches.slice(0, 10);
  }, [selected, initialSelected, query, fuse, sortedBlocks]);

  return (
    <Container className="px-0 h-100" fluid>
      <Row className="h-100">
        <Col md={4} className="h-100">
          <InputGroup className="mr-sm-2">
            <InputGroup.Prepend>
              <InputGroup.Text>Search</InputGroup.Text>
            </InputGroup.Prepend>
            <Form.Control
              id="query"
              placeholder="Start typing to find results"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
            />
          </InputGroup>
          <ListGroup
            className={cx("overflow-auto", "h-100", styles.blockResults)}
          >
            {results.map((result) => (
              <BlockResult
                key={result.id}
                block={result}
                active={selected?.id === result.id}
                onSelect={() => {
                  setSelected(result);
                }}
              />
            ))}
          </ListGroup>
        </Col>
        <Col md={8} className={cx("pt-4")}>
          {selected ? (
            <BrickDetail
              block={selected}
              blockConfig={blockConfig}
              isBlockConfigLoading={isBlockConfigLoading}
            />
          ) : (
            <div>
              <GridLoader />
            </div>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default BrickReference;
