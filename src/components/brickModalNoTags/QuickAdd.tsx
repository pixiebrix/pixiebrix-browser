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

import styles from "./QuickAdd.module.scss";

import React from "react";
import { Card } from "react-bootstrap";
import BrickIcon from "@/components/BrickIcon";
import cx from "classnames";
import { type Metadata } from "@/types/registryTypes";

type OwnProps<T extends Metadata> = {
  onSelect: (block: T) => void;
  recommendations: T[];
};

const QuickAdd = <T extends Metadata>({
  recommendations = [],
  onSelect,
}: OwnProps<T>) => (
  <div>
    <h4>Recommended Bricks</h4>
    <div className={styles.root}>
      {recommendations.map((brick) => (
        <Card
          className={styles.card}
          key={brick.id}
          onClick={() => {
            onSelect(brick);
          }}
        >
          <Card.Body className={cx("text-center", "pt-2", styles.cardImage)}>
            <div>
              <BrickIcon brick={brick} />
            </div>
          </Card.Body>
          <Card.Body>
            <Card.Title>{brick.name}</Card.Title>
            <Card.Text className="small pt-2">{brick.description}</Card.Text>
          </Card.Body>
        </Card>
      ))}
    </div>
  </div>
);

export default QuickAdd;
