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
import React, { useCallback, useState, useEffect, useContext } from "react";
import { Modal, Button } from "react-bootstrap";

type ModalProps = {
  title?: string;
  message: string;
  submitCaption?: string;
  cancelCaption?: string;
};

type ModalContextProps = {
  showConfirmation: (modalProps: ModalProps) => Promise<boolean>;
};

const initialModalState: ModalContextProps = {
  showConfirmation: () => {
    throw new Error("showConfirmation not configured");
  },
};

export const ModalContext = React.createContext<ModalContextProps>(
  initialModalState
);

const ConfirmationModal: React.FunctionComponent<
  ModalProps & { onCancel: () => void; onSubmit: () => void }
> = ({ title, message, submitCaption, onCancel, onSubmit }) => {
  return (
    <Modal show onHide={onCancel} backdrop="static" keyboard={false}>
      <Modal.Header closeButton>
        <Modal.Title>{title ?? "Confirm?"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{message}</Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onSubmit}>
          {submitCaption ?? "Continue"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

type Callback = (submit: boolean) => void;

export const ModalProvider: React.FunctionComponent<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [modalProps, setModalProps] = useState<ModalProps>();
  const [callback, setCallback] = useState<Callback>();

  useEffect(() => {
    return () => {
      callback?.(false);
    };
  }, [callback]);

  const showConfirmation = useCallback(
    async (modalProps: ModalProps) => {
      // cancel any previous modal that was showing
      callback?.(false);
      return new Promise<boolean>((resolve) => {
        setModalProps(modalProps);
        const newCallback = (submit: boolean) => {
          setModalProps(undefined);
          resolve(submit);
          setCallback(undefined);
        };
        setCallback((_prevState: Callback) => newCallback);
      });
    },
    [callback, setModalProps]
  );

  return (
    <ModalContext.Provider value={{ showConfirmation }}>
      {modalProps && (
        <ConfirmationModal
          {...modalProps}
          onSubmit={() => callback(true)}
          onCancel={() => callback(false)}
        />
      )}
      {children}
    </ModalContext.Provider>
  );
};

export function useModals(): ModalContextProps {
  return useContext(ModalContext);
}
