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

import { uniq, compact, sortBy, unary, intersection } from "lodash";
import getCssSelector, { css_selector_type } from "css-selector-generator";
import { isNullOrBlank, mostCommonElement } from "@/utils";

const BUTTON_TAGS: string[] = ["li", "button", "a", "span", "input", "svg"];
const BUTTON_SELECTORS: string[] = ["[role='button']"];
const ICON_TAGS = ["svg", "img"];
const MENU_TAGS = ["ul", "tbody"];
const CAPTION_TAGS = ["td", "a", "li", "span"];
const MULTI_ATTRS = ["class", "rel"];
const HEADER_TAGS = ["header", "h1", "h2", "h3", "h4", "h5", "h6"];
// Layout tags that should be preserved during panel inference
const LAYOUT_TAGS = ["section", "header", "div", "article", "aside"];
const TEXT_TAGS = ["span", "p", "b", "h1", "h2", "h3", "h4", "h5", "h6"];

const ATTR_SKIP_ELEMENT_PATTERNS = [
  /^chevron-down$/,
  /^([\dA-Za-z]+)-chevron-down$/,
];

/**
 * Attribute names to exclude
 */
const ATTR_EXCLUDE_PATTERNS = [
  /^id$/,
  /^name$/,
  /^data([\w-]*)-test([\w-]*)$/,
  // Cypress attributes
  /^data-cy$/,
  // Angular attributes
  /^_ngcontent-.*/,
  /^_nghost-.*/,
  /^ng-.*/,
  // Exclude tabindex to avoid breaking standard tab navigation
  /^tabindex$/,
  // Exclude non-role aria attributes because they're generally unique across elements
  /^aria-(?!role).*$/,
];

const VALUE_EXCLUDE_PATTERNS = new Map<string, RegExp[]>([
  ["class", [/^ember-view$/]],
]);

class SkipElement extends Error {
  constructor(msg: string) {
    super(msg);
  }
}

function outerHTML($element: JQuery<HTMLElement | Text>): string {
  // Trick to get the HTML of the actual element
  return $("<div>").append($element.clone()).html();
}

function escapeDoubleQuotes(str: string): string {
  // https://gist.github.com/getify/3667624
  return str.replace(/\\([\S\s])|(")/g, "\\$1$2");
}

/**
 * Returns true iff any of the immediate children are text nodes.
 * @param $element
 */
function hasTextNodeChild($element: JQuery<HTMLElement>): boolean {
  return $element
    .contents()
    .get()
    .some((x) => x.nodeType === Node.TEXT_NODE);
}

function commonAttr($items: JQuery<HTMLElement>, attr: string) {
  const attributeValues = $items
    .toArray()
    .map((x) => x.attributes.getNamedItem(attr)?.value);

  let unfiltered: string[];

  // For classes and rel we take the common values
  if (MULTI_ATTRS.includes(attr)) {
    const classNames = attributeValues.map((x) => (x ? x.split(" ") : []));
    unfiltered = intersection(...classNames);
  } else if (uniq(attributeValues).length === 1) {
    unfiltered = attributeValues[0].split(" ");
  } else {
    // Single attribute doesn't match
    return null;
  }

  const exclude = VALUE_EXCLUDE_PATTERNS.get(attr) ?? [];

  const filtered = unfiltered.filter(
    (value) => !exclude.some((regex) => regex.test(value))
  );

  return filtered.length > 0 ? filtered.join(" ") : null;
}

function setCommonAttrs(
  $common: JQuery<HTMLElement>,
  $items: JQuery<HTMLElement>
) {
  const proto = $items.get(0);

  const attributes = proto.attributes;

  // Find the common attributes between the elements
  for (const attrIndex in Object.keys(attributes)) {
    // safe because we're getting from Object.keys
    // eslint-disable-next-line security/detect-object-injection
    const attrName = attributes[attrIndex].name;

    if (ATTR_EXCLUDE_PATTERNS.some((x) => x.test(attrName))) {
      continue;
    }

    const value = commonAttr($items, attrName);
    if (value != null) {
      if (
        value
          .split(" ")
          .some((value) =>
            ATTR_SKIP_ELEMENT_PATTERNS.some((test) => test.test(value))
          )
      ) {
        throw new SkipElement(
          "Attribute value contains value in the skip list"
        );
      }

      $common.attr(attrName, value);
    }
  }
}

function ignoreDivChildNode(node: Node): boolean {
  return (
    [Node.COMMENT_NODE, Node.CDATA_SECTION_NODE].includes(node.nodeType) ||
    (node.nodeType === Node.TEXT_NODE && node.textContent.trim() === "")
  );
}

function removeUnstyledLayout(node: Node): Node | null {
  if ([Node.COMMENT_NODE, Node.CDATA_SECTION_NODE].includes(node.nodeType)) {
    return null;
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as HTMLElement;
    const nonEmptyChildren = [...node.childNodes].filter(
      (x) => !ignoreDivChildNode(x)
    );
    if (
      // This is a bit of a hack - the DIV element may impact layout because it's a block element
      ["DIV"].includes(element.tagName) &&
      isNullOrBlank(element.className) &&
      nonEmptyChildren.length === 1
    ) {
      return removeUnstyledLayout(nonEmptyChildren[0]);
    }
    const clone = node.cloneNode(false) as Element;
    for (const childNode of node.childNodes) {
      const newChild = removeUnstyledLayout(childNode);
      if (newChild != null) {
        clone.append(newChild);
      }
    }
    return clone;
  }
  return node.cloneNode(false);
}

/**
 * Recursively extract common HTML template from one or more buttons/menu item.
 * @param $items JQuery of HTML elements
 * @param captioned true, if the generated HTML template already includes a caption
 * placeholder
 */
function commonButtonStructure(
  $items: JQuery<HTMLElement>,
  captioned = false
): [JQuery<HTMLElement | Text>, boolean] {
  let currentCaptioned = captioned;

  const proto = $items.get(0);

  if (ICON_TAGS.includes(proto.tagName.toLowerCase())) {
    // TODO: need to provide a way of adding additional classes to the button. E.g. some classes
    //  may provide for the margin, etc.
    return [$(document.createTextNode(`{{{ icon }}}`)), currentCaptioned];
  }

  const $common = $(`<${proto.tagName.toLowerCase()}>`);

  try {
    setCommonAttrs($common, $items);
  } catch (error) {
    if (error instanceof SkipElement) {
      // Shouldn't happen at the top level
      return [$(), currentCaptioned];
    }
    throw error;
  }

  // Heuristic that assumes elements match from the beginning
  for (
    let nodeIndex = 0, elementIndex = 0;
    nodeIndex < proto.childNodes.length;
    nodeIndex++
  ) {
    const protoChild = proto.childNodes.item(nodeIndex);

    if (
      protoChild.nodeType === Node.TEXT_NODE &&
      !currentCaptioned &&
      protoChild.textContent &&
      protoChild.textContent?.trim() !== ""
    ) {
      $common.append(document.createTextNode("{{{ caption }}}"));
      currentCaptioned = true;
    } else if (
      protoChild.nodeType === Node.ELEMENT_NODE &&
      $items.toArray().every((x) => elementIndex < x.children.length) &&
      uniq($items.toArray().map((x) => x.children.item(elementIndex).tagName))
        .length === 1
    ) {
      const $children = $items.map(function () {
        return this.children.item(elementIndex) as HTMLElement;
      });

      const [child, childCaptioned] = commonButtonStructure(
        $children,
        currentCaptioned
      );
      $common.append(child);
      currentCaptioned ||= childCaptioned;

      elementIndex++;
    }
  }

  if (proto.tagName === "A") {
    $common.attr("href", "#");
  }

  if (
    !currentCaptioned &&
    $common.children().length === 0 &&
    CAPTION_TAGS.includes(proto.tagName.toLowerCase())
  ) {
    $common.append(document.createTextNode("{{{ caption }}}"));
    currentCaptioned = true;
  }

  return [$common, currentCaptioned];
}

type PanelStructureState = {
  inHeader: boolean;
  bodyInserted: boolean;
  headingInserted: boolean;
};

/**
 * Recursively extract common HTML template from one or more panels.
 * @param $items JQuery of HTML elements
 * @param state current traversal/insertion state
 */
function commonPanelStructure(
  $items: JQuery<HTMLElement>,
  {
    inHeader = false,
    headingInserted = false,
    bodyInserted = false,
  }: PanelStructureState = {} as PanelStructureState
): [JQuery<HTMLElement | Text>, PanelStructureState] {
  const proto = $items.get(0);
  inHeader = inHeader || HEADER_TAGS.includes(proto.tagName.toLowerCase());

  const $common = $(`<${proto.tagName.toLowerCase()}>`);

  setCommonAttrs($common, $items);

  // Heuristic that assumes tag matches from the beginning
  for (let i = 0; i < proto.children.length; i++) {
    const protoChild = proto.children.item(i) as HTMLElement;
    const $protoChild = $(protoChild);

    if (
      $items.toArray().every((x) => i < x.children.length) &&
      uniq($items.toArray().map((x) => x.children.item(i).tagName)).length ===
        1 &&
      (!headingInserted ||
        LAYOUT_TAGS.includes(proto.children.item(i).tagName.toLowerCase()))
    ) {
      const $children = $items.map(function () {
        return this.children.item(i) as HTMLElement;
      });
      const [inner, innerState] = commonPanelStructure($children, {
        bodyInserted,
        headingInserted,
        inHeader,
      });
      bodyInserted = innerState.bodyInserted;
      headingInserted = innerState.headingInserted;
      $common.append(inner);
    } else if (
      !headingInserted &&
      HEADER_TAGS.some((tag) => $protoChild.has(tag))
    ) {
      const [header] = buildHeader(protoChild);
      $common.append(header);
      headingInserted = true;
    } else if (
      !inHeader &&
      !bodyInserted &&
      !LAYOUT_TAGS.includes(proto.children.item(i).tagName.toLowerCase())
    ) {
      $common.append(document.createTextNode("{{{ body }}}"));
      bodyInserted = true;
    }
  }

  if (inHeader && !headingInserted && hasTextNodeChild($(proto))) {
    $common.append(document.createTextNode("{{{ heading }}}"));
    headingInserted = true;
  }

  return [$common, { inHeader, bodyInserted, headingInserted }];
}

function buildHeader(proto: HTMLElement): [JQuery<HTMLElement>, boolean] {
  const tag = proto.tagName.toLowerCase();
  const $inferred = $(`<${tag}>`);
  setCommonAttrs($inferred, $(proto));

  let inserted = false;

  for (let i = 0; i < proto.children.length; i++) {
    const child = proto.children.item(i) as HTMLElement;

    // Recurse structurally
    const [childHeader, childInserted] = buildHeader(child);
    $inferred.append(childHeader);
    inserted ||= childInserted;
  }

  if (!inserted && TEXT_TAGS.includes(tag) && hasTextNodeChild($(proto))) {
    $inferred.append(document.createTextNode("{{{ heading }}}"));
    inserted = true;
  }

  return [$inferred, inserted];
}

function buildBody(proto: HTMLElement): [JQuery<HTMLElement | Text>, boolean] {
  let inserted = false;

  const tag = proto.tagName.toLowerCase();

  if (!LAYOUT_TAGS.includes(tag)) {
    return [$(document.createTextNode("{{{ body }}}")), true];
  }

  const $inferred = $(`<${proto.tagName.toLowerCase()}>`);
  setCommonAttrs($inferred, $(proto));

  for (let i = 0; i < proto.children.length; i++) {
    const child = proto.children.item(i) as HTMLElement;
    const childTag = child.tagName.toLowerCase();

    if (LAYOUT_TAGS.includes(childTag)) {
      const [childElement, childInserted] = buildBody(child);
      inserted ||= childInserted;
      $inferred.append(childElement);
    } else if (!inserted && !LAYOUT_TAGS.includes(childTag)) {
      inserted = true;
      $inferred.append(document.createTextNode("{{{ body }}}"));
    }
  }

  return [$inferred, inserted];
}

export function buildSinglePanelElement(
  proto: HTMLElement,
  { headingInserted = false }: PanelStructureState = {} as PanelStructureState
): [JQuery<HTMLElement>, PanelStructureState] {
  let bodyInserted = false;

  const $inferred = $(`<${proto.tagName.toLowerCase()}>`);
  setCommonAttrs($inferred, $(proto));

  for (let i = 0; i < proto.children.length; i++) {
    const child = proto.children.item(i) as HTMLElement;
    const $child = $(child);

    if (!headingInserted && HEADER_TAGS.some((tag) => $child.has(tag))) {
      const [header] = buildHeader(child);
      $inferred.append(header);
      headingInserted = true;
    } else if (headingInserted && !bodyInserted) {
      const [childBody, childInserted] = buildBody(child);
      $inferred.append(childBody);
      bodyInserted ||= childInserted;
    }
  }

  return [$inferred, { inHeader: false, headingInserted, bodyInserted }];
}

function commonButtonHTML(tag: string, $items: JQuery<HTMLElement>): string {
  if ($items.length === 0) {
    throw new Error(`No items provided`);
  }

  const elements = compact(
    $items.toArray().map(unary(removeUnstyledLayout))
  ).filter((x) => x.nodeType === Node.ELEMENT_NODE);

  for (const element of elements) {
    console.log(outerHTML($(element as HTMLElement)));
  }

  const [$common] = commonButtonStructure($(elements as HTMLElement[]));

  // Trick to get the HTML of the actual element
  return $("<div>").append($common.clone()).html();
}

function commonPanelHTML(tag: string, $items: JQuery<HTMLElement>): string {
  if ($items.length === 0) {
    throw new Error(`No items provided`);
  }

  const [$common, { bodyInserted, headingInserted }] = commonPanelStructure(
    $items
  );

  if (!bodyInserted) {
    console.warn("No body detected for panel");
  }
  if (!headingInserted) {
    console.warn("No heading detected for panel");
  }

  return outerHTML($common);
}

const DEFAULT_SELECTOR_PRIORITIES: css_selector_type[] = [
  "tag",
  "id",
  "class",
  "attribute",
  "nthoftype",
  "nthchild",
];

/**
 * Calls getCssSelector with smarter handling of undefined root element and blacklisting common
 * front-end framework elements that aren't good for selectors
 */
export function safeCssSelector(
  element: HTMLElement,
  selectors: css_selector_type[] | undefined,
  root: Element = undefined
): string {
  // https://github.com/fczbkk/css-selector-generator

  const selector = getCssSelector(element, {
    blacklist: ["#ember*", "[data-aura-rendered-by]"],
    selectors: selectors ?? DEFAULT_SELECTOR_PRIORITIES,
    combineWithinSelector: true,
    combineBetweenSelectors: true,
    // convert null to undefined, because getCssSelector bails otherwise
    root: root ?? undefined,
  });

  if (root == null && selector.startsWith(":nth-child")) {
    // JQuery will happily return other matches that match the nth-child chain, so make attach it to the body
    // to get the expected CSS selector behavior
    return `body${selector}`;
  }

  return selector;
}

/**
 * Generate some CSS selector variants for an element.
 */
export function inferSelectors(
  element: HTMLElement,
  root: Element = undefined
): string[] {
  const makeSelector = (allowed: css_selector_type[]) => {
    try {
      return safeCssSelector(element, allowed, root);
    } catch (error) {
      console.warn("Selector inference failed", {
        element,
        allowed,
        root,
        error,
      });
    }
  };

  return sortBy(
    uniq(
      compact([
        makeSelector(["id", "class", "tag", "attribute", "nthchild"]),
        makeSelector(["tag", "class", "attribute", "nthchild"]),
        makeSelector(["id", "tag", "attribute", "nthchild"]),
        makeSelector(["id", "tag", "attribute"]),
        makeSelector(undefined),
      ])
    ).filter((x) => (x ?? "").trim() !== ""),
    (x) => x.length
  );
}

/**
 * Returns true if selector uniquely identifies an element on the page
 */
function isUniqueSelector(selector: string): boolean {
  return $(document).find(selector).length === 1;
}

export function getCommonAncestor(...args: Node[]): Node {
  if (args.length === 1) {
    return args[0].parentNode;
  }

  const [node, ...otherNodes] = args;

  let currentNode: Node | null = node;

  while (currentNode) {
    if (otherNodes.every((x) => currentNode.contains(x))) {
      return currentNode;
    }
    currentNode = currentNode?.parentNode;
  }

  return null;
}

export function findContainerForElement(
  element: HTMLElement
): { container: HTMLElement; selectors: string[] } {
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
    const descendent = level == 1 ? ">" : "> * >";

    if (element.tagName === "INPUT") {
      extra.push(
        `${container.tagName.toLowerCase()}:has(${descendent} input[value="${escapeDoubleQuotes(
          element.getAttribute("value")
        )}"])`
      );
    } else {
      extra.push(
        `${container.tagName.toLowerCase()}:has(${descendent} ${element.tagName.toLowerCase()}:contains("${escapeDoubleQuotes(
          $(element).text().trim()
        )}"))`
      );
    }
  }

  return {
    container,
    selectors: uniq([
      ...extra.filter(isUniqueSelector),
      ...inferSelectors(container),
    ]),
  };
}

export function findContainer(
  elements: HTMLElement[]
): { container: HTMLElement; selectors: string[] } {
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
 * Find direct children of the container that contain each selected descendent element
 * @param $container the panel container
 * @param selected the selected descendent elements
 */
function containerChildren(
  $container: JQuery<HTMLElement>,
  selected: HTMLElement[]
): HTMLElement[] {
  return selected.map((element) => {
    const exactMatch = $container.children().filter(function () {
      return this === element;
    });

    if (exactMatch.length > 0) {
      return exactMatch.get(0);
    }

    const match = $container.children().has(element);

    if (match.length === 0) {
      throw new Error("element not found in container");
    }

    return match.get(0);
  });
}

export function inferSinglePanelHTML(
  container: HTMLElement,
  selected: HTMLElement
): string {
  const $container = $(container);
  const child = containerChildren($container, [selected])[0];
  const [$panel] = buildSinglePanelElement(child);
  return outerHTML($panel);
}

export function inferPanelHTML(
  container: HTMLElement,
  selected: HTMLElement[]
): string {
  const $container = $(container);

  if (selected.length > 1) {
    const children = containerChildren($container, selected);
    return commonPanelHTML(selected[0].tagName, $(children));
  }
  return inferSinglePanelHTML(container, selected[0]);
}

export function inferButtonHTML(
  container: HTMLElement,
  selected: HTMLElement[]
): string {
  const $container = $(container);

  if (selected.length === 0) {
    throw new Error("one or more prototype button-like elements required");
  } else if (selected.length > 1) {
    const children = containerChildren($container, selected);
    // vote on the root tag
    const tag = mostCommonElement(selected.map((x) => x.tagName)).toLowerCase();
    return commonButtonHTML(tag, $(children));
  } else {
    const element = selected[0];
    for (const buttonTag of [...BUTTON_SELECTORS, ...BUTTON_TAGS]) {
      const $items = $container.children(buttonTag);
      if (
        $items.length > 0 &&
        ($items.is(element) || $items.has(element).length > 0)
      ) {
        if (buttonTag === "input") {
          const commonType = commonAttr($items, "type") ?? "button";
          const inputType = ["submit", "reset"].includes(commonType)
            ? "button"
            : commonType;
          return `<input type="${inputType}" value="{{{ caption }}}" />`;
        }
        return commonButtonHTML(buttonTag, $items);
      }
    }

    throw new Error(
      `Did not find any button-like tags in container ${container.tagName}`
    );
  }
}
