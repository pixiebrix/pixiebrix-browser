/*
 * Copyright (C) 2022 PixieBrix, Inc.
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

import { compact, identity, sortBy, uniq } from "lodash";
import { getCssSelector } from "css-selector-generator";
import { CssSelectorType } from "css-selector-generator/types/types";
import { $safeFind } from "@/helpers";
import { EXTENSION_POINT_DATA_ATTR, PIXIEBRIX_DATA_ATTR } from "@/common";
import { guessUsefulness, isRandomString } from "@/utils/detectRandomString";
import { matchesAnyPattern } from "@/utils";
import { escapeSingleQuotes } from "@/utils/escape";
import { CONTENT_SCRIPT_READY_ATTRIBUTE } from "@/contentScript/ready";

export const BUTTON_TAGS: string[] = [
  "li",
  "button",
  "a",
  "span",
  "input",
  "svg",
];
const MENU_TAGS = ["ul", "tbody"];

export const UNIQUE_ATTRIBUTES: string[] = [
  "id",
  "name",

  // Data attributes people use in automated tests are unlikely to change frequently
  "data-cy", // Cypress
  "data-testid",
  "data-id",
  "data-test",
  "data-test-id",
];
// eslint-disable-next-line security/detect-non-literal-regexp -- Not user-provided
const UNIQUE_ATTRIBUTES_REGEX = new RegExp(
  UNIQUE_ATTRIBUTES.map((attribute) => `^\\[${attribute}=`).join("|")
);

export const UNIQUE_ATTRIBUTES_SELECTOR = UNIQUE_ATTRIBUTES.map(
  (attribute) => `[${attribute}]`
).join(",");

const UNSTABLE_SELECTORS = [
  // Emberjs component tracking
  /#ember/,

  // Vuejs component tracking
  /^\[data-v-/,

  getAttributeSelectorRegex(
    // Salesforce Aura component tracking
    "data-aura-rendered-by",

    // Our attributes
    EXTENSION_POINT_DATA_ATTR,
    PIXIEBRIX_DATA_ATTR,
    CONTENT_SCRIPT_READY_ATTRIBUTE
  ),
];

function getUniqueAttributeSelectors(element: HTMLElement): string[] {
  return UNIQUE_ATTRIBUTES.map((attribute) =>
    getAttributeSelector(attribute, element.getAttribute(attribute))
  ).filter((selector) => !matchesAnyPattern(selector, UNSTABLE_SELECTORS));
}

/** ID selectors and certain other attributes can uniquely identify items */
function isSelectorUsuallyUnique(selector: string): boolean {
  return selector.startsWith("#") || UNIQUE_ATTRIBUTES_REGEX.test(selector);
}

/**
 * Return selectors sorted by quality
 * - getSelectorPreference
 * - length (lower is better)
 * @param selectors an array of selectors, or items with selector properties to sort
 * @param iteratee a method to select the selector field for an item
 *
 * @see getSelectorPreference
 */
export function sortBySelector(selectors: string[]): string[];
export function sortBySelector<Item>(
  selectors: Item[],
  iteratee: (selector: Item) => string
): Item[];
export function sortBySelector<Item = string>(
  selectors: Item[],
  iteratee?: (selector: Item) => string
): Item[] {
  const select = iteratee ?? identity;
  return sortBy(
    selectors,
    (x) => getSelectorPreference(select(x)),
    (x) => select(x).length
  );
}

/**
 * Prefers unique selectors and classes. A lower number means higher preference.
 *
 * Do not call directly. Instead, call sortBySelector
 *
 * @example
 * -4  '#best-link-on-the-page'
 * -3  "[data-cy='b4da55']"
 * -2  '.iAmAUniqueGreatClassSelector' // it's rare case but happens when classname is unique
 * -1  '#parentId a' // tag name followed by parent unique Selector
 * -1  '[data-test-id='b4da55'] input' // tag name followed by parent unique Selector
 *  0  '.navItem'
 *  0  '.birdsArentReal'
 *  1  'a'
 *
 * @see sortBySelector
 */
export function getSelectorPreference(selector: string): number {
  // @ts-expect-error: TS compiler can't find the propery find in $
  const tokenized = $.find.tokenize(selector);
  if (tokenized.length > 1) {
    throw new TypeError(
      "Expected single selector, received selector list: " + selector
    );
  }

  const tokenCount = tokenized[0].length;

  if (selector.includes(":nth-child")) {
    // Structural selectors are fragile to page changes, so give low score
    return 2;
  }

  // Unique ID selectors can only be simple. When composed, ID selectors are always followed by non-unique parts
  if (selector.startsWith("#") && tokenCount === 1) {
    return -4;
  }

  if (isSelectorUsuallyUnique(selector)) {
    if (tokenCount === 1) {
      return -3;
    }

    return -1;
  }

  if (selector.startsWith(".") && tokenCount === 1) {
    return -2;
  }

  if (selector.startsWith(".")) {
    return 0;
  }

  return 1;
}

const DEFAULT_SELECTOR_PRIORITIES: Array<keyof typeof CssSelectorType> = [
  "id",
  "tag",
  "class",
  "attribute",
  "nthoftype",
  "nthchild",
];

interface SafeCssSelectorOptions {
  selectors?: Array<keyof typeof CssSelectorType>;
  root?: Element;
  excludeRandomClasses?: boolean;
}

/**
 * Generates a regex to test attribute selectors generated by `css-selector-generator`,
 * to be used in the whitelist/blacklist arrays. The regex will match any selector with or
 * without a value specified: `[attr]`, `[attr='value']`
 * @example getAttributeSelectorRegex('name', 'aria-label')
 * @returns /^\[name(=|]$)|^\[aria-label(=|]$)/
 */
export function getAttributeSelectorRegex(...attributes: string[]): RegExp {
  // eslint-disable-next-line security/detect-non-literal-regexp -- Not user-provided
  return new RegExp(
    attributes.map((attribute) => `^\\[${attribute}(=|]$)`).join("|")
  );
}

/**
 * Calls getCssSelector with smarter handling of undefined root element and blacklisting common
 * front-end framework elements that aren't good for selectors
 */
export function safeCssSelector(
  element: HTMLElement,
  {
    selectors = DEFAULT_SELECTOR_PRIORITIES,
    excludeRandomClasses = false,
    // eslint-disable-next-line unicorn/no-useless-undefined -- Convert null to undefined or else getCssSelector bails
    root = undefined,
  }: SafeCssSelectorOptions = {}
): string {
  // https://github.com/fczbkk/css-selector-generator

  const selector = getCssSelector(element, {
    blacklist: [
      ...UNSTABLE_SELECTORS,

      excludeRandomClasses
        ? (selector) => {
            if (!selector.startsWith(".")) {
              return false;
            }

            const usefulness = guessUsefulness(selector);
            console.debug("css-selector-generator:  ", usefulness);
            return usefulness.isRandom;
          }
        : undefined,
    ],
    whitelist: [getAttributeSelectorRegex(...UNIQUE_ATTRIBUTES)],
    selectors,
    combineWithinSelector: true,
    combineBetweenSelectors: true,
    root,
  });

  if (root == null && selector.startsWith(":nth-child")) {
    // JQuery will happily return other matches that match the nth-child chain, so make attach it to the body
    // to get the expected CSS selector behavior
    return `body${selector}`;
  }

  return selector;
}

function findAncestorsWithIdLikeSelectors(
  element: HTMLElement,
  root?: Element
): HTMLElement[] {
  // eslint-disable-next-line unicorn/no-array-callback-reference -- jQuery false positive
  return $(element).parentsUntil(root).filter(UNIQUE_ATTRIBUTES_SELECTOR).get();
}

export function inferSelectorsIncludingStableAncestors(
  element: HTMLElement,
  root?: Element,
  excludeRandomClasses?: boolean
): string[] {
  const stableAncestors = findAncestorsWithIdLikeSelectors(
    element,
    root
  ).flatMap((stableAncestor) =>
    inferSelectors(element, stableAncestor, excludeRandomClasses).flatMap(
      (selector) =>
        getUniqueAttributeSelectors(stableAncestor)
          .filter(Boolean)
          .map((stableAttributeSelector) =>
            [stableAttributeSelector, selector].join(" ")
          )
    )
  );

  return sortBySelector(
    compact(
      uniq([
        ...inferSelectors(element, root, excludeRandomClasses),
        ...stableAncestors,
      ])
    )
  );
}

/**
 * Generate some CSS selector variants for an element.
 */
export function inferSelectors(
  element: HTMLElement,
  root?: Element,
  excludeRandomClasses?: boolean
): string[] {
  const makeSelector = (allowed?: Array<keyof typeof CssSelectorType>) => {
    try {
      return safeCssSelector(element, {
        selectors: allowed,
        root,
        excludeRandomClasses,
      });
    } catch (error) {
      console.warn("Selector inference failed", {
        element,
        allowed,
        root,
        error,
      });
    }
  };

  return sortBySelector(
    compact(
      uniq([
        makeSelector(["id", "class", "tag", "attribute", "nthchild"]),
        makeSelector(["tag", "class", "attribute", "nthchild"]),
        makeSelector(["id", "tag", "attribute", "nthchild"]),
        makeSelector(["id", "tag", "attribute"]),
        makeSelector(["class", "tag", "attribute"]),
        makeSelector(),
      ])
    )
  );
}

/**
 * Returns true if selector uniquely identifies an element on the page
 */
function doesSelectOneElement(selector: string): boolean {
  return $safeFind(selector).length === 1;
}

export function getCommonAncestor(...args: Node[]): Node {
  if (args.length === 1) {
    return args[0].parentNode;
  }

  const [node, ...otherNodes] = args;

  let currentNode: Node | null = node;

  while (currentNode) {
    // eslint-disable-next-line @typescript-eslint/no-loop-func -- The function is used immediately
    if (otherNodes.every((x) => currentNode.contains(x))) {
      return currentNode;
    }

    currentNode = currentNode?.parentNode;
  }

  return null;
}

export function findContainerForElement(element: HTMLElement): {
  container: HTMLElement;
  selectors: string[];
} {
  let container = element;
  let level = 0;

  if (BUTTON_TAGS.includes(element.tagName.toLowerCase())) {
    container = element.parentElement;
    level++;
  }

  /**
   * If the direct parent is a list item or column, that's most li
   */
  if (MENU_TAGS.includes(container.parentElement.tagName.toLowerCase())) {
    container = container.parentElement;
    level++;
  }

  const extra: string[] = [];

  if (container !== element) {
    const descendent = level === 1 ? ">" : "> * >";

    if (element.tagName === "INPUT") {
      extra.push(
        `${container.tagName.toLowerCase()}:has(${descendent} input[value='${escapeSingleQuotes(
          element.getAttribute("value")
        )}'])`
      );
    } else {
      extra.push(
        `${container.tagName.toLowerCase()}:has(${descendent} ${element.tagName.toLowerCase()}:contains('${escapeSingleQuotes(
          $(element).text().trim()
        )}'))`
      );
    }
  }

  return {
    container,
    selectors: uniq([
      ...extra.filter((selector) => doesSelectOneElement(selector)),
      ...inferSelectors(container),
    ]),
  };
}

export function findContainer(elements: HTMLElement[]): {
  container: HTMLElement;
  selectors: string[];
} {
  if (elements.length > 1) {
    const container = getCommonAncestor(...elements) as HTMLElement | null;
    if (!container) {
      throw new Error("Selected elements have no common ancestors");
    }

    return {
      container,
      selectors: inferSelectors(container),
    };
  }

  return findContainerForElement(elements[0]);
}

/**
 * @param name   Like "id", "data-test"
 * @param value  Like "main-nav", "user-sidebar"
 * @return  Like "#main-nav", "[data-test='user-sidebar']"
 */
export function getAttributeSelector(
  name: string,
  value: string | null
): string | null {
  if (!value) {
    return;
  }

  // Must be specified here or else the next condition creates `[id='something']`
  if (name === "id") {
    return "#" + CSS.escape(value);
  }

  if (
    name === "title" ||
    name.startsWith("aria-") ||
    UNIQUE_ATTRIBUTES.includes(name)
  ) {
    //  Must use single quotes to match `css-selector-generator`
    return `[${name}='${CSS.escape(value)}']`;
  }
}

function getClassSelector(className: string): string | null {
  if (!isRandomString(className)) {
    return "." + CSS.escape(className);
  }
}

/**
 * Get an array of "simple selectors" for the target element
 * https://www.w3.org/TR/selectors-4/#grammar
 * @example ["h1", ".bold", ".italic", "[aria-label=Title]"]
 */
function getElementSelectors(target: Element): string[] {
  const attributeSelectors = [...target.attributes].map(({ name, value }) =>
    getAttributeSelector(name, value)
  );
  const classSelectors = [...target.classList].map((className) =>
    getClassSelector(className)
  );

  return compact([
    ...attributeSelectors,
    ...classSelectors,
    target.tagName.toLowerCase(),
  ]);
}

/**
 * Get a single "compound selector" for the target element
 * https://www.w3.org/TR/selectors-4/#grammar
 * @example "h1.bold.italic[aria-label=Title]"
 */
function getElementSelector(target: Element): string {
  return getElementSelectors(target).join("");
}

/**
 * Get an array of unfiltered selectors for each parent of the target
 *
 * @example ["main", "div", "div.content", "p[title='Your project']", "span.title"]
 */
function getSelectorTree(target: HTMLElement): string[] {
  return $(target)
    .parentsUntil("body")
    .addBack()
    .get()
    .map((ancestor) => getElementSelector(ancestor));
}

/**
 * Generate a selector for the target element
 *
 * @example "main div.content > p[title='Your project'] > span.title"
 */
export function generateSelector(target: HTMLElement): string {
  // Merge tree, but
  return (
    getSelectorTree(target)
      .join(" > ")
      // Avoid bland selectors
      .replace(/^(div > )+/, "")
      .replaceAll(" > div > ", " ")
  );
}
