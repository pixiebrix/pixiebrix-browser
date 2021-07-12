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

import React from "react";
import { InputValidationError } from "@/blocks/errors";
import { Col, Row } from "react-bootstrap";
import JSONTree from "@/components/JSONTree";

const InputValidationErrorDetail: React.FunctionComponent<{
  error: InputValidationError;
}> = ({ error }) => {
  return (
    <Row>
      <Col>
        <span>Errors</span>
        <ul>
          {error.errors.map((x) => (
            <li key={`${x.keywordLocation}-${x.error}`}>
              {x.keywordLocation}: {x.error}
            </li>
          ))}
        </ul>
      </Col>
      <Col>
        <span>Rendered Args</span>
        <JSONTree data={error.input} />
      </Col>
      <Col>
        <span>Schema</span>
        <JSONTree data={error.schema} />
      </Col>
    </Row>
  );
};

export default InputValidationErrorDetail;
