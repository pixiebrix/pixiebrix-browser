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

import { Carousel, Modal } from "react-bootstrap";
import React from "react";
import { expectContext } from "@/utils/expectContext";
import { showModal } from "@/bricks/transformers/ephemeralForm/modalUtils";
import { getThisFrame } from "webext-messenger";
import { registerModal } from "@/contentScript/walkthroughModalProtocol";
import { closeWalkthroughModal } from "@/contentScript/messenger/api";
import { Target } from "@/types/messengerTypes";

let controller: AbortController;
export const WalkthroughModalApp: React.FunctionComponent = () => {
  const params = new URLSearchParams(location.search);
  const opener = JSON.parse(params.get("opener")) as Target;

  return (
    <Modal
      backdrop={false}
      animation={false}
      show={true}
      onHide={() => {
        closeWalkthroughModal(opener);
      }}
    >
      <Modal.Header closeButton />
      <Carousel>
        <Modal.Body>hello world!</Modal.Body>
      </Carousel>
    </Modal>
  );
};

export const showWalkthroughModal = async () => {
  expectContext("contentScript");

  controller = new AbortController();

  const target = await getThisFrame();

  const frameSource = new URL(browser.runtime.getURL("walkthroughModal.html"));
  frameSource.searchParams.set("nonce", "page-editor-walkthrough");
  frameSource.searchParams.set("opener", JSON.stringify(target));
  frameSource.searchParams.set("mode", "modal");

  const modal = registerModal();
  showModal({ url: frameSource, controller });

  await modal;
  controller.abort();
};
