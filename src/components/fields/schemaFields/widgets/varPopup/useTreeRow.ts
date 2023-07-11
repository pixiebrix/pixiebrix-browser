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

import { type MutableRefObject, useEffect } from "react";

type HoverListener = {
  onMouseEnter: (element: HTMLElement) => void;
  onMouseExit: (element: HTMLElement) => void;
};

// OK to use module-level tracking, because there will only ever be one VariablesTree rendered at a time
const hoverListeners = new Set<HoverListener>();

function addHoverListener(listener: HoverListener): void {
  hoverListeners.add(listener);
}

function removeHoverListener(listener: HoverListener): void {
  hoverListeners.delete(listener);
}

function notifyMouseEnter(element: HTMLElement): void {
  for (const listener of hoverListeners) {
    listener.onMouseEnter(element);
  }
}

function notifyMouseExit(element: HTMLElement): void {
  for (const listener of hoverListeners) {
    listener.onMouseExit(element);
  }
}

/**
 * A hack to make JSON Tree rows clickable/highlightable.
 * @param buttonRef ref for the label in the row
 * @param onSelect callback to call when the row is clicked
 * @param isActive whether the row is currently active
 */
function useTreeRow({
  buttonRef,
  onSelect,
  isActive,
}: {
  buttonRef: MutableRefObject<HTMLElement>;
  onSelect: () => void;
  isActive: boolean;
}) {
  useEffect(() => {
    if (buttonRef.current) {
      // Find the containing row in the JSONTree
      const $row = $(buttonRef.current).closest("li");
      const row = $row.get(0);

      $row.click((event) => {
        if (event.target === row) {
          event.preventDefault();
          event.stopPropagation();

          onSelect();
        }
      });

      $row.mouseenter(() => {
        notifyMouseEnter(row);
      });

      $row.mouseover((event) => {
        if (event.target === row) {
          notifyMouseEnter(row);
        }

        event.stopPropagation();
      });

      $row.mouseleave(() => {
        notifyMouseExit(row);
      });

      const listener: HoverListener = {
        onMouseEnter(element) {
          if (element === row) {
            $row.addClass("hover");
          } else {
            // Handle the case where user moves mouse over the nested properties. It's still over the parent, so
            // we wouldn't have seen a mousexit event yet
            $row.removeClass("hover");
          }
        },
        onMouseExit(element) {
          if (element === row) {
            $row.removeClass("hover");
          }
        },
      };

      addHoverListener(listener);

      return () => {
        removeHoverListener(listener);
        $row.off("click");
        $row.off("mouseenter");
      };
    }
  }, [buttonRef, onSelect]);

  useEffect(() => {
    if (buttonRef.current) {
      // Find the containing row in the JSONTree
      const $row = $(buttonRef.current).closest("li");

      if (isActive) {
        $row.addClass("active");

        // https://caniuse.com/scrollintoviewifneeded
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supported by Chromium
        ($row.get(0) as any).scrollIntoViewIfNeeded?.({ behavior: "smooth" });
      } else {
        $row.removeClass("active");
      }
    }
  }, [buttonRef, isActive]);
}

export default useTreeRow;
