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

import {
  compact,
  identity,
  intersection,
  mapValues,
  sortBy,
  uniq,
} from "lodash";
import { getCssSelector } from "css-selector-generator";
import { type CssSelectorType } from "css-selector-generator/types/types";
import { $safeFind } from "@/helpers";
import { EXTENSION_POINT_DATA_ATTR, PIXIEBRIX_DATA_ATTR } from "@/common";
import { guessUsefulness, isRandomString } from "@/utils/detectRandomString";
import { matchesAnyPattern } from "@/utils";
import { escapeSingleQuotes } from "@/utils/escape";
import { CONTENT_SCRIPT_READY_ATTRIBUTE } from "@/contentScript/ready";
import {
  getSiteSelectorHint,
  SELECTOR_HINTS,
  type SelectorTemplate,
  type SiteSelectorHint,
} from "@/utils/inference/siteSelectorHints";
import { type ElementInfo } from "@/pageScript/frameworks";
import { type Framework } from "@/pageScript/messenger/constants";
import * as pageScript from "@/pageScript/messenger/api";
import { renderString } from "nunjucks";

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
  "role",

  // Data attributes people use in automated tests are unlikely to change frequently
  "data-cy", // Cypress
  "data-testid",
  "data-id",
  "data-test",
  "data-test-id",

  // Register UNIQUE_ATTRIBUTES from all hints because we can't check site rules in this usage.
  ...SELECTOR_HINTS.flatMap((hint) => hint.uniqueAttributes),
];

// eslint-disable-next-line security/detect-non-literal-regexp -- Not user-provided
const UNIQUE_ATTRIBUTES_REGEX = new RegExp(
  UNIQUE_ATTRIBUTES.map((attribute) => `^\\[${attribute}=`).join("|")
);

const UNIQUE_ATTRIBUTES_SELECTOR = UNIQUE_ATTRIBUTES.map(
  (attribute) => `[${attribute}]`
).join(",");

const UNSTABLE_SELECTORS = [
  // Emberjs component tracking
  /#ember/,

  // Vuejs component tracking
  /^\[data-v-/,

  getAttributeSelectorRegex(
    // Our attributes
    EXTENSION_POINT_DATA_ATTR,
    PIXIEBRIX_DATA_ATTR,
    CONTENT_SCRIPT_READY_ATTRIBUTE,
    "style"
  ),
];

function getUniqueAttributeSelectors(
  element: HTMLElement,
  siteSelectorHint: SiteSelectorHint
): string[] {
  return UNIQUE_ATTRIBUTES.map((attribute) =>
    getAttributeSelector(attribute, element.getAttribute(attribute))
  ).filter(
    (selector) =>
      !matchesAnyPattern(selector, [
        ...UNSTABLE_SELECTORS,
        // We need to include salesforce BAD_PATTERNS here as well since this function is used to get inferSelectorsIncludingStableAncestors
        ...siteSelectorHint.badPatterns,
      ])
  );
}

/**
 * Convert classname of element to meaningful selector
 */
function getSelectorFromClass(className: string): string {
  const classHelper = document.createElement("i");
  classHelper.className = className;
  return "." + [...classHelper.classList].join(".");
}

/**
 * Return true if a selector is likely to uniquely identify an element.
 */
function isSelectorUsuallyUnique(selector: string): boolean {
  return selector.startsWith("#") || UNIQUE_ATTRIBUTES_REGEX.test(selector);
}

/**
 * Return selectors sorted by quality
 * - getSelectorPreference
 * - textual length (lower is better)
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
 * -1  '[data-test-id='b4da55'] input' // tag name preceded by parent unique Selector
 *  0  '.navItem'
 *  0  '.birdsArentReal'
 *  1  'a'
 *
 * @see sortBySelector
 */
export function getSelectorPreference(selector: string): number {
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
  allowMultiSelection?: boolean;
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
  elements: HTMLElement[],
  {
    selectors = DEFAULT_SELECTOR_PRIORITIES,
    excludeRandomClasses = false,
    // eslint-disable-next-line unicorn/no-useless-undefined -- Convert null to undefined or else getCssSelector bails
    root = undefined,
  }: SafeCssSelectorOptions = {}
): string {
  // https://github.com/fczbkk/css-selector-generator
  const siteSelectorHint = getSiteSelectorHint(elements[0]);

  const blacklist = [
    ...UNSTABLE_SELECTORS,
    ...siteSelectorHint.badPatterns,

    excludeRandomClasses
      ? (selector: string) => {
          if (!selector.startsWith(".")) {
            return false;
          }

          const usefulness = guessUsefulness(selector);
          console.debug("css-selector-generator:  ", usefulness);
          return usefulness.isRandom;
        }
      : undefined,
  ];
  const whitelist = [
    getAttributeSelectorRegex(...UNIQUE_ATTRIBUTES),
    ...siteSelectorHint.stableAnchors,
  ];

  const selector = getCssSelector(elements, {
    blacklist,
    whitelist,
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

/**
 * Returns true if selectors match any of the same elements.
 */
function selectorsOverlap(
  lhs: string,
  rhs: string,
  root?: HTMLElement
): boolean {
  return (
    intersection($safeFind(lhs, root).get(), $safeFind(rhs, root).get())
      .length > 0
  );
}

/**
 * Heuristically infer selector for elements and similar elements on the page.
 *
 * The generated selector will match at least all the user-selected `elements`.
 *
 * Used by the "expand selection" feature in the Selection Tool.
 **
 * @param elements user-selected elements
 * @param selectors list of selector types to use, in order of preference
 * @param excludeRandomClasses true to heuristically excluded random classnames
 * @param root the root to generate selectors relative to
 */
export function expandedCssSelector(
  elements: HTMLElement[],
  {
    selectors = DEFAULT_SELECTOR_PRIORITIES,
    excludeRandomClasses = false,
    // eslint-disable-next-line unicorn/no-useless-undefined -- Convert null to undefined or else getCssSelector bails
    root = undefined,
  }: SafeCssSelectorOptions = {}
): string {
  // All elements are on the same page, so just use first element for siteSelectorHint
  // https://github.com/fczbkk/css-selector-generator
  const siteSelectorHint = getSiteSelectorHint(elements[0]);

  const blacklist = [
    ...UNSTABLE_SELECTORS,
    ...siteSelectorHint.badPatterns,

    excludeRandomClasses
      ? (selector: string) => {
          if (!selector.startsWith(".")) {
            return false;
          }

          const usefulness = guessUsefulness(selector);
          console.debug("css-selector-generator:  ", usefulness);
          return usefulness.isRandom;
        }
      : undefined,
  ];
  const whitelist = [
    getAttributeSelectorRegex(...UNIQUE_ATTRIBUTES),
    ...siteSelectorHint.stableAnchors,
    ...siteSelectorHint.requiredSelectors,
  ];

  // Find ancestors of each user-selected element. Unlike single-element select, includes both
  // unique attributes and classnames (classnames might not be stable).
  const elementAncestors = elements.map((element) =>
    $(element)
      .parentsUntil(root)
      .filter(
        [...UNIQUE_ATTRIBUTES, "class"]
          .map((attribute) => `[${attribute}]`)
          .join(",")
      )
      .get()
  );

  // Get an arbitrary common ancestor. (Will likely be first element because parentsUntil works from the element upward)
  // Might not exist if the root doesn't have any of stable attributes/classname
  const [closestCommonAncestor] = intersection(...elementAncestors);

  if (!closestCommonAncestor) {
    return;
  }

  // Get selector of common ancestor
  const commonAncestorSelector = getCssSelector(closestCommonAncestor, {
    blacklist,
    whitelist: ["class", "tag", ...whitelist],
    selectors,
    combineWithinSelector: true,
    combineBetweenSelectors: true,
    root,
  });

  // Get common attribute of parent of user selected elements. Will be used before to use the ">" immediate descendant
  // operator for the elements.
  //
  // Using the parent or another level of ancestor is helpful for preventing over-matching on based on the user-selected
  // elements attribute/tag name selector.
  //
  // TODO: look for all common attributes that could be non-unique, e.g., aria-role="button"
  // TODO: right now this is picking an arbitrary class name
  const [commonParentClassName] = intersection(
    ...elements.map((element) => [$(element).parent().attr("class")])
  );

  const commonSelector =
    commonAncestorSelector &&
    commonParentClassName &&
    !selectorsOverlap(
      commonAncestorSelector,
      getSelectorFromClass(commonParentClassName)
    )
      ? [
          commonAncestorSelector,
          getSelectorFromClass(commonParentClassName),
          ">",
        ].join(" ")
      : commonAncestorSelector;

  // Get common attributes of user-selected elements
  // TODO: look for all common attribute values that would be non-unique: e.g., aria-role="button"
  // TODO: right now this is picking an arbitrary class name
  const [commonElementClassName] = intersection(
    ...elements.map((element) => element.className.split(" "))
  );

  if (commonElementClassName) {
    return [commonSelector, getSelectorFromClass(commonElementClassName)].join(
      " "
    );
  }

  // Union of all tag types for the selected elements
  // For example: #root a, #root span
  return uniq(elements.map((element) => element.tagName))
    .map((tagName) => [commonSelector, tagName.toLowerCase()].join(" "))
    .join(", ");
}

function findAncestorsWithIdLikeSelectors(
  element: HTMLElement,
  root?: Element
): HTMLElement[] {
  // eslint-disable-next-line unicorn/no-array-callback-reference -- jQuery false positive
  return $(element).parentsUntil(root).filter(UNIQUE_ATTRIBUTES_SELECTOR).get();
}

function getElementAttributes(element: HTMLElement) {
  const attributes: Record<string, string> = {};

  $.each(element.attributes, function () {
    attributes[this.name] = this.value;
  });

  return attributes;
}

function maybeInstantiateSelectorTemplate(
  ancestorElement: HTMLElement,
  template: SelectorTemplate
): string | null {
  if (!ancestorElement.matches(template.selector)) {
    return null;
  }

  const extractedValues = mapValues(template.extract, (extractRule: string) => {
    const element = $safeFind(extractRule, ancestorElement);

    if (!element) {
      return null;
    }

    return {
      ...getElementAttributes(element[0]),
      text: element.text(),
    };
  });

  // All extraction rules must match, otherwise return no match
  if (Object.values(extractedValues).some((value) => value == null)) {
    return null;
  }

  return renderString(template.template, extractedValues);
}

/**
 * Return a selector matching one of the provided templates, or null if none of the templates match
 * @param ancestorElement an ancestor of the element to generate the selector for
 * @param templates the selector templates/stencils to try
 * @param root the root element to generate selectors relative to. Used to ensure the generated selector is unique
 */
function getAncestorSelectorTemplate({
  ancestorElement,
  root,
  templates,
}: {
  ancestorElement: HTMLElement;
  templates: SelectorTemplate[];
  root?: HTMLElement | Document | JQuery<HTMLElement | Document>;
}): string | null {
  // Find first template that matches and uniquely selects the ancestor
  return templates
    .map((template) =>
      maybeInstantiateSelectorTemplate(ancestorElement, template)
    )
    .find(
      (selector) => selector != null && doesSelectOneElement(selector, root)
    );
}

function getMatchingRequiredSelectors(
  element: HTMLElement,
  requiredSelectors: string[]
) {
  return requiredSelectors.find((selector) => element.matches(selector));
}

/**
 * Return selectors for ancestors of the element based on the matching selector hint, if any hint matches.
 * @param element The element to generate selectors for
 * @param root the root to generate selectors against, either a DOM element or the document
 */
function mapSelectorOverrideToAncestors(
  element: HTMLElement,
  root: HTMLElement | Document
): Array<{ element: HTMLElement; selectorOverride: string }> {
  const { requiredSelectors, selectorTemplates } = getSiteSelectorHint(element);

  const ancestors =
    root === document
      ? $(element).parents().get()
      : $(element)
          .parentsUntil(root as HTMLElement)
          .get();

  // Ancestors from root to element
  ancestors.reverse();

  let currentRoot = root;
  const result = [];

  for (const ancestor of ancestors) {
    const selectorOverride =
      getAncestorSelectorTemplate({
        ancestorElement: ancestor,
        root: currentRoot,
        templates: selectorTemplates,
      }) ?? getMatchingRequiredSelectors(ancestor, requiredSelectors);

    if (selectorOverride) {
      currentRoot = ancestor;
      result.push({ element: ancestor, selectorOverride });
    }
  }

  return result;
}

export function inferSelectorsIncludingStableAncestors(
  element: HTMLElement,
  root?: Element,
  excludeRandomClasses?: boolean
): string[] {
  const siteSelectorHint = getSiteSelectorHint(element);
  const stableAncestors = findAncestorsWithIdLikeSelectors(
    element,
    root
  ).flatMap((stableAncestor) =>
    inferSelectors(element, stableAncestor, excludeRandomClasses).flatMap(
      (selector) =>
        getUniqueAttributeSelectors(stableAncestor, siteSelectorHint)
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
      return safeCssSelector([element], {
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

type InferSelectorArgs = {
  /**
   * The root to generate the selector with respect to. Provide null to use the document.
   */
  root: HTMLElement | null;
  /**
   * True to exclude class names that appear to be randomly generated.
   */
  excludeRandomClasses: boolean;
};

/**
 * @deprecated framework-based (e.g., React/Vue/etc.) traversal is deprecated
 */
type FrameworkSelectorArgs = {
  /**
   * The front-end framework to assume for component traversal.
   */
  framework?: Framework;
  /**
   * Number of non-DOM components to traverse up.
   */
  traverseUp: number;
};

/**
 * Infers valids selectors for a single element.
 * @see inferMultiElementSelector
 */
export async function inferSingleElementSelector({
  element,
  root,
  excludeRandomClasses,
  framework,
  traverseUp,
}: InferSelectorArgs &
  FrameworkSelectorArgs & {
    element: HTMLElement;
  }): Promise<ElementInfo> {
  if (framework) {
    // We're using pageScript getElementInfo only when specific framework is used.
    // On Salesforce we were running into an issue where certain selectors weren't finding any elements when
    // run from the pageScript. It might have something to do with the custom web components Salesforce uses?
    // In any case, the pageScript is not necessary if framework is not specified, because selectElement
    // only needs to return the selector alternatives.
    const selector = safeCssSelector([element], {
      excludeRandomClasses,
    });

    // XXX: pageScript.getElementInfo doesn't support `root` because we can't pass an element across the pageScript
    // boundary.
    return pageScript.getElementInfo({
      selector,
      framework,
      traverseUp,
    });
  }

  // Ancestors in order from root to element
  const ancestorSelectorOverrides = mapSelectorOverrideToAncestors(
    element,
    root
  );

  const ancestorSelectors = ancestorSelectorOverrides.map(
    ({ selectorOverride }) => selectorOverride
  );

  const rootOverride =
    // Scope the element generation to the innermost ancestor with a selector override
    ancestorSelectorOverrides.length > 0
      ? ancestorSelectorOverrides.at(-1).element
      : root;

  const selectorWithRootOverride = safeCssSelector([element], {
    root: rootOverride,
    excludeRandomClasses,
  });

  // Prepend all the selectors with the required selectors
  const inferredSelectors = uniq(
    [
      selectorWithRootOverride,
      ...inferSelectorsIncludingStableAncestors(element, rootOverride),
    ].map((selector) => [...ancestorSelectors, selector].join(" "))
  );

  // Filter out any malformed selectors and/or selectors that don't exactly match the element
  const validatedSelectors = inferredSelectors.filter((selector) => {
    try {
      const match = $safeFind(selector, root);
      return match.length === 1 && match.get(0) === element;
    } catch {
      console.warn("Invalid selector", selector);
      // Catch invalid selectors
      return false;
    }
  });

  if (validatedSelectors.length === 0) {
    throw new Error("Automatic selector generation failed");
  }

  return {
    selectors: validatedSelectors,
    framework: null,
    hasData: false,
    tagName: element.tagName,
    parent: null,
  };
}

/**
 * Infer a selector that matches multiple elements.
 * @param elements the example elements
 * @param root the root element, or null to generate with respect to the document
 * @param excludeRandomClasses true to attempt to exclude random classes, e.g. CSS module hashes
 * @param shouldSelectSimilar true to expand the selector to match similar elements
 * @see inferSingleElementSelector
 */
export function inferMultiElementSelector({
  elements,
  root,
  excludeRandomClasses,
  shouldSelectSimilar,
}: InferSelectorArgs & {
  elements: HTMLElement[];
  shouldSelectSimilar?: boolean;
}): ElementInfo {
  const selector = shouldSelectSimilar
    ? expandedCssSelector(elements, {
        root,
        excludeRandomClasses,
      })
    : safeCssSelector(elements, {
        root,
        excludeRandomClasses,
      });

  const inferredSelectors = uniq([
    selector,
    // TODO: Discuss if it's worth to include stableAncestors for multi-element selector
    // ...inferSelectorsIncludingStableAncestors(elements[0]),
  ]);

  return {
    selectors: inferredSelectors,
    framework: null,
    hasData: false,
    tagName: elements[0].tagName, // Will first element tag be enough/same for all elements?
    parent: null,
    isMulti: true,
  };
}

/**
 * Returns true if selector uniquely identifies a single element on the page.
 */
function doesSelectOneElement(
  selector: string,
  parent?: HTMLElement | Document | JQuery<HTMLElement | Document>
): boolean {
  return $safeFind(selector, parent).length === 1;
}

export function getCommonAncestor(...args: HTMLElement[]): HTMLElement {
  if (args.length === 1) {
    return args[0].parentElement;
  }

  const [node, ...otherNodes] = args;

  let currentNode = node;

  while (currentNode) {
    // eslint-disable-next-line @typescript-eslint/no-loop-func -- The function is used immediately
    if (otherNodes.every((x) => currentNode.contains(x))) {
      return currentNode;
    }

    currentNode = currentNode?.parentElement;
  }

  return null;
}

function findContainerForElement(element: HTMLElement): {
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
    const container = getCommonAncestor(...elements);
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
    target.tagName.toLowerCase(),
    ...attributeSelectors,
    ...classSelectors,
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
    .map((ancestor: Element) => getElementSelector(ancestor));
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
