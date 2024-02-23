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

import styles from "./useScrollLock.module.scss";
import { scrollbarWidth } from "@xobotyi/scrollbar-width";
import { useEffect } from "react";

// Don't wrap this with `memoize`/`once` because it depends on the content and window size, which may vary over time.
function doesNeedScrollbarPlaceholder(element: HTMLElement) {
  if (scrollbarWidth() === 0) {
    // We're ignoring nested `specific-element::scrollbar` styling for simplicity.
    return false;
  }

  const { overflowY } = window.getComputedStyle(element);

  if (overflowY === "scroll") {
    // Always shown
    return true;
  }

  if (overflowY === "scroll") {
    // Never shown
    return false;
  }

  // `auto`: it depends on the content
  return element.clientHeight < element.scrollHeight;
}

function useScrollLock(state: boolean) {
  useEffect(() => {
    const scrollableRoot =
      window.getComputedStyle(document.body).overflowY === "scroll"
        ? document.body
        : document.documentElement;

    scrollableRoot.classList.toggle(styles.scrollLocked, state);
    scrollableRoot.classList.toggle(
      styles.hadScrollbar,
      state && doesNeedScrollbarPlaceholder(scrollableRoot),
    );

    return () => {
      scrollableRoot.classList.remove(styles.scrollLocked);
      scrollableRoot.classList.remove(styles.hadScrollbar);
    };
  }, [state]);
}

export default useScrollLock;
