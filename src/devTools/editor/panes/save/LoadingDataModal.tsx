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
import { Modal } from "react-bootstrap";
import GridLoader from "react-spinners/GridLoader";

type OwnProps = {
  onClose: () => void;
};

const LoadingDataModal: React.FC<OwnProps> = ({ onClose }) => (
  <Modal show onHide={onClose} backdrop="static" keyboard={false}>
    <Modal.Header closeButton>
      <Modal.Title>Loading data...</Modal.Title>
    </Modal.Header>

    <Modal.Body>
      <GridLoader />
    </Modal.Body>
  </Modal>
);

export default LoadingDataModal;
