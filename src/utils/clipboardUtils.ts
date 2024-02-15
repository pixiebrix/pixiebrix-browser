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

import { BusinessError } from "@/errors/businessErrors";
import legacyCopyText from "copy-text-to-clipboard";
import { getErrorMessage } from "@/errors/errorHelpers";
import { focusCaptureDialog } from "@/contentScript/focusCaptureDialog";
import { isPromiseFulfilled } from "./promiseUtils";
import { writeToClipboardInFocusedDocument } from "@/background/messenger/strict/api";

export type ContentType = "infer" | "text" | "image";

/** Serializable ClipboardItem-like object */
export type ClipboardText = {
  text: string;
  html?: string;
};

export function detectContentType(content: unknown): "text" | "image" {
  if (typeof content === "string" && content.startsWith("data:image/")) {
    return "image";
  }

  return "text";
}

function isDocumentFocusError(error: unknown): boolean {
  // Chrome throws a DOMException with the message "Document is not focused" when it can't establish a user action
  // for the clipboard write request
  // https://stackoverflow.com/questions/56306153/domexception-on-calling-navigator-clipboard-readtext/70386674#70386674
  return getErrorMessage(error)
    .toLowerCase()
    .includes("document is not focused");
}

function isPermissionError(error: unknown): boolean {
  return getErrorMessage(error).toLowerCase().includes("has been blocked");
}

export async function nonInteractivelyWriteToClipboard({
  text,
  html,
}: ClipboardText): Promise<boolean> {
  const items: Record<string, Blob> = {
    "text/plain": new Blob([text], { type: "text/plain" }),
  };

  if (html) {
    items["text/html"] = new Blob([html], { type: "text/html" });
  }

  return isPromiseFulfilled(
    navigator.clipboard.write([new ClipboardItem(items)]),
  );
}

/**
 * Copy to clipboard, and prompt user to interact with page if the browser blocks the clipboard write due to focus
 * @param clipboardItems the ClipboardItems to copy to the clipboard
 * @param type the data type, to show in the message to the user.
 */
async function interactiveWriteToClipboard(
  clipboardItems: ClipboardItems,
  { type }: { type: "text" | "image" },
): Promise<void> {
  try {
    await navigator.clipboard.write(clipboardItems);
  } catch (error) {
    if (!isDocumentFocusError(error)) {
      throw error;
    }

    await focusCaptureDialog(
      `Please click "OK" to allow PixieBrix to copy ${type} to your clipboard.`,
    );

    // Let the error be caught by the caller if it still fails
    await navigator.clipboard.write(clipboardItems);
  }
}

/**
 * Copy text to the clipboard, prompting the user to interact with the page if the browser blocks the clipboard write.
 * @param text the text to copy to the clipboard
 * @param html optional HTML content to copy to the clipboard for pasting into rich text editors
 */
export async function writeTextToClipboard({
  text,
  html,
}: ClipboardText): Promise<boolean> {
  // Attempt to write to the clipboard in the last focused document
  if (
    !document.hasFocus() &&
    (await writeToClipboardInFocusedDocument({ text, html }))
  ) {
    return true;
  }

  // If the document is focused, or the last focused document is not available, continue here interactively

  try {
    // https://stackoverflow.com/a/74216984/402560
    const items: Record<string, Blob> = {
      "text/plain": new Blob([text], { type: "text/plain" }),
    };

    if (html) {
      items["text/html"] = new Blob([html], { type: "text/html" });
    }

    await interactiveWriteToClipboard(
      // Fails in frame contexts if the frame CSP doesn't include clipboard-write. Unfortunately, that includes the
      // Chrome DevTools. In this case, will fall back to legacy method in the catch block
      [new ClipboardItem(items)],
      { type: "text" },
    );
  } catch (error) {
    if (isPermissionError(error)) {
      // Deprecated method of copying text to clipboard doesn't require clipboard-write in frame CSP.
      // It can sometimes return `true` even if the text wasn't actually copied so try to use navigator.clipboard first
      // The legacy approach uses a hidden text area and document.execCommand('copy') under the hood
      const copied = legacyCopyText(text);
      if (!copied) {
        throw new BusinessError("Unable to write text to clipboard", {
          cause: error,
        });
      }

      return true;
    }

    throw error;
  }

  return true;
}

/**
 * Writes items to the clipboard, prompting the user to interact with the page if the browser blocks the clipboard write.
 * @param items the items to copy to the clipboard
 * @param type type to include in the message to the user if they need to interact with the page to copy to the clipboard
 * @see writeTextToClipboard
 */
export async function writeItemsToClipboard(
  items: ClipboardItems,
  {
    type,
  }: {
    // Only allow image so caller uses writeTextToClipboard instead for text
    type: "image";
  },
): Promise<void> {
  await interactiveWriteToClipboard(items, {
    type,
  });
}
