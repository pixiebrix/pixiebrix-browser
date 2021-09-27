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

import { Transformer } from "@/types";
import { BlockArg, Schema } from "@/core";
import { uuidv4 } from "@/types/helpers";
import theme from "bootstrap/dist/css/bootstrap.min.css?loadAsUrl";
import { browser } from "webextension-polyfill-ts";
import { registerForm } from "@/contentScript/modalForms";
import { expectContext } from "@/utils/expectContext";
import { whoAmI } from "@/background/messenger/api";

const MODAL_OPEN_CLASS = "pixiebrix-modal-open";
const HIGHEST_Z_INDEX = 2_147_483_647;

export class ModalTransformer extends Transformer {
  defaultOutputKey = "form";

  constructor() {
    super(
      "@pixiebrix/form-modal",
      "Show a modal form",
      "Show a modal form and return the input",
      "faCode"
    );
  }

  inputSchema: Schema = {
    type: "object",
    properties: {
      schema: {
        type: "object",
        description: "The JSON Schema for the form",
        additionalProperties: true,
      },
      uiSchema: {
        type: "object",
        description: "The react-jsonschema-form uiSchema for the form",
        additionalProperties: true,
      },
      cancelable: {
        type: "boolean",
        description:
          "Whether or not the user can cancel the form (default=true)",
        default: true,
      },
      submitCaption: {
        type: "string",
        description: "The submit button caption (default='Submit')",
        default: "Submit",
      },
    },
    required: ["schema"],
  };

  async transform({
    schema,
    uiSchema = {},
    cancelable = true,
    submitCaption = "Submit",
  }: BlockArg): Promise<unknown> {
    expectContext("contentScript");

    // Future improvements:
    // - Support draggable modals. This will require showing the modal header on the host page so there's a drag handle?

    const container = document.createElement("div");
    const shadowRoot = container.attachShadow({ mode: "closed" });

    const nonce = uuidv4();
    const id = `modal-${nonce}`;

    const tab = await whoAmI();

    const frameSrc = new URL(browser.runtime.getURL("modalForm.html"));
    frameSrc.searchParams.set("nonce", nonce);
    frameSrc.searchParams.set(
      "opener",
      JSON.stringify({ tabId: tab.tab.id, frameId: tab.frameId })
    );

    // By setting the modal-content 100vh, the iframe form content can expand to fit the available vertical size as
    // needed. Otherwise, we'd need to have the form message the content script with a requested vertical height.
    // (We might do this anyway in the future to support draggable modals)
    $(shadowRoot).append(`
        <link rel="stylesheet" href="${theme}" />
        <div class="modal-backdrop show" style="z-index: ${HIGHEST_Z_INDEX}"></div>
        <div id="${id}" class="modal show" style="display: block; z-index: ${HIGHEST_Z_INDEX}">
            <div class="modal-dialog modal-dialog-scrollable" role="document">
                <div class="modal-content" style="height: 100vh; background: none transparent; border: none;">
                    <iframe src="${frameSrc.toString()}" frameborder="0" allowtransparency="true" width="100%" height="100%"/>
                </div>
            </div>
        </div>
    `);

    $(document.body).addClass(MODAL_OPEN_CLASS);

    document.body.append(container);

    const modal = shadowRoot.querySelector("#" + id);

    // Try to intercept click handler on the host page. Doesn't work on all sites, e.g., Trello that define a
    // `click` handler on document with `useCapture: true`.
    // See https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener

    modal.addEventListener("click", (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    });

    const $modal = $(modal);

    // Isolated use; not worth installing types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let modalController: any;
    // @ts-expect-error -- isolated use
    void import("bootstrap/js/src/modal").then(({ default: Modal }) => {
      modalController = new Modal(modal);
      modalController._checkScrollbar();
      modalController._setScrollbar();
    });

    $modal.css("z-index", HIGHEST_Z_INDEX);
    $modal.find("iframe").trigger("focus");

    try {
      return await registerForm(nonce, {
        schema,
        uiSchema,
        cancelable,
        submitCaption,
      });
    } finally {
      container.remove();
      $(document.body).removeClass(MODAL_OPEN_CLASS);

      if (modalController) {
        modalController._hideModal();
      }
    }
  }
}
