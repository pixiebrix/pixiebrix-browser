/*
 * Copyright (C) 2024 PixieBrix, Inc.
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

import { openTab } from "@/background/messenger/api";
import excludeAltClicksEtc from "filter-altered-clicks";

/**
 * Causes all unaltered links to open in new tabs.
 *
 * This is only used for Edge at the moment. You can achieve the same result via a single `<base target="_blank">` tag in the `<head>`.
 * https://github.com/pixiebrix/pixiebrix-extension/issues/7809
 */
export default function openAllLinksInPopups({
  onlyTargetBlank,
  signal,
}: { signal?: AbortSignal; onlyTargetBlank?: boolean } = {}) {
  document.body.addEventListener(
    "click",
    excludeAltClicksEtc((event: MouseEvent) => {
      // `composedPath` is used to support clicks in an `open` Shadow DOM
      // https://github.com/pixiebrix/pixiebrix-extension/issues/8206
      for (const eventTarget of event.composedPath()) {
        if (eventTarget instanceof HTMLAnchorElement) {
          if (onlyTargetBlank && eventTarget.target !== "_blank") {
            return;
          }

          // Ignore same-page links
          if (eventTarget.getAttribute("href")?.startsWith("#")) {
            return;
          }

          // Open a new window instead of a new tab because changing the tab will close the sidebar
          // https://github.com/pixiebrix/pixiebrix-extension/pull/8216#issuecomment-2048914921
          // TODO: Remove `newWindow` after https://github.com/microsoft/MicrosoftEdge-Extensions/issues/142
          void openTab({ url: eventTarget.href, newWindow: true });
          event.preventDefault();
          return;
        }
      }
    }),
    { signal },
  );
}
