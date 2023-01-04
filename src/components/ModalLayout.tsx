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
import { Modal } from "react-bootstrap";

type ModalLayoutProps = React.PropsWithChildren<{
  title: string;
  show: boolean;
  onHide: () => void;

  className?: string;
  dialogClassName?: string;
  contentClassName?: string;
}>;

const ModalLayout: React.FunctionComponent<ModalLayoutProps> = ({
  title,
  show,
  onHide,
  children,
  className,
  dialogClassName,
  contentClassName,
}) => (
  <Modal
    show={show}
    onHide={onHide}
    className={className}
    dialogClassName={dialogClassName}
    contentClassName={contentClassName}
  >
    <Modal.Header closeButton>
      <Modal.Title>{title}</Modal.Title>
    </Modal.Header>
    {show && children}
  </Modal>
);

export default ModalLayout;
