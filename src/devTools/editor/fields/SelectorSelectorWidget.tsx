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

import React, { useCallback, useContext, useMemo, useState } from "react";
import { DevToolsContext } from "@/devTools/context";
import useNotifications from "@/hooks/useNotifications";
import { compact, isEmpty, sortBy, uniqBy } from "lodash";
import {
  disableOverlay,
  enableSelectorOverlay,
  selectElement,
} from "@/background/devtools";
import { getErrorMessage } from "@/errors";
import { Button } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMousePointer } from "@fortawesome/free-solid-svg-icons";
import CreatableAutosuggest, {
  SuggestionTypeBase,
} from "@/devTools/editor/fields/creatableAutosuggest/CreatableAutosuggest";
import { ElementInfo } from "@/nativeEditor/frameworks";
import SelectorListItem from "@/devTools/editor/fields/selectorListItem/SelectorListItem";
import { Framework } from "@/messaging/constants";
import { SelectMode } from "@/nativeEditor/selector";
import { CustomFieldWidget } from "@/components/form/FieldTemplate";
import { useField } from "formik";

interface ElementSuggestion extends SuggestionTypeBase {
  value: string;
  elementInfo?: ElementInfo;
}

export type SelectorSelectorProps = {
  initialElement?: ElementInfo;
  framework?: Framework;
  selectMode?: SelectMode;
  traverseUp?: number;
  isClearable?: boolean;
  sort?: boolean;
  root?: string;
  disabled?: boolean;
};

function getSuggestionsForElement(
  elementInfo: ElementInfo | undefined
): ElementSuggestion[] {
  if (!elementInfo) {
    return [];
  }

  return uniqBy(
    compact([
      ...(elementInfo.selectors ?? []).map((value) => ({ value, elementInfo })),
      ...getSuggestionsForElement(elementInfo.parent),
    ]).filter(
      (suggestion) => suggestion.value && suggestion.value.trim() !== ""
    ),
    (suggestion) => suggestion.value
  );
}

function renderSuggestion(suggestion: ElementSuggestion): React.ReactNode {
  return (
    <SelectorListItem
      value={suggestion.value}
      hasData={suggestion.elementInfo.hasData}
      tag={suggestion.elementInfo.tagName}
    />
  );
}

const SelectorSelectorWidget: CustomFieldWidget<SelectorSelectorProps> = ({
  name,
  initialElement,
  framework,
  selectMode = "element",
  traverseUp = 0,
  isClearable = false,
  // Leave off default here because we dynamically determine default based on `selectMode`
  sort: rawSort,
  root,
  disabled = false,
  placeholder = "Choose a selector...",
}) => {
  const [{ value }, , { setValue }] = useField<string>(name);

  // By default, sort by selector length in `element` selection mode. Don't sort in `container` mode because
  // the order is based on structure (because selectors for multiple elements are returned).
  const defaultSort = selectMode === "element";
  const sort = rawSort ?? defaultSort;

  const { port } = useContext(DevToolsContext);
  const notify = useNotifications();
  const [element, setElement] = useState(initialElement);
  const [isSelecting, setSelecting] = useState(false);

  const suggestions: ElementSuggestion[] = useMemo(() => {
    const raw = getSuggestionsForElement(element);
    return sort ? sortBy(raw, (x) => x.value.length) : raw;
  }, [element, sort]);

  const enableSelector = useCallback(
    (selector: string) => {
      try {
        void enableSelectorOverlay(port, selector);
      } catch {
        // The enableSelector function throws errors on invalid selector
        // values, so we're eating everything here since this fires any
        // time the user types in the input.
      }
    },
    [port]
  );

  const disableSelector = useCallback(() => {
    void disableOverlay(port);
  }, [port]);

  const onHighlighted = useCallback(
    (suggestion: ElementSuggestion | null) => {
      if (suggestion) {
        enableSelector(suggestion.value);
      } else {
        disableSelector();
      }
    },
    [enableSelector, disableSelector]
  );

  const onTextChanged = useCallback(
    (value: string) => {
      disableSelector();
      enableSelector(value);
      setValue(value);
    },
    [disableSelector, enableSelector, setValue]
  );

  const select = useCallback(async () => {
    setSelecting(true);
    try {
      const selected = await selectElement(port, {
        framework,
        mode: selectMode,
        traverseUp,
        root,
      });

      if (isEmpty(selected)) {
        notify.error("Unknown error selecting element", {
          error: new Error("selectElement returned empty object"),
        });
        return;
      }

      setElement(selected);

      const selectors = selected.selectors ?? [];

      const firstSelector = (sort
        ? sortBy(selectors, (x) => x.length)
        : selectors)[0];

      console.debug("Setting selector", { selected, firstSelector });
      setValue(firstSelector);
    } catch (error: unknown) {
      notify.error(`Error selecting element: ${getErrorMessage(error)}`, {
        error,
      });
    } finally {
      setSelecting(false);
    }
  }, [
    port,
    sort,
    framework,
    notify,
    setSelecting,
    traverseUp,
    selectMode,
    setElement,
    setValue,
    root,
  ]);

  return (
    <div className="d-flex">
      <div>
        <Button
          onClick={select}
          disabled={isSelecting || disabled}
          variant="info"
          aria-label="Select element"
        >
          <FontAwesomeIcon icon={faMousePointer} />
        </Button>
      </div>
      <div className="flex-grow-1">
        <CreatableAutosuggest
          isClearable={isClearable}
          isDisabled={isSelecting || disabled}
          suggestions={suggestions}
          inputValue={value}
          inputPlaceholder={placeholder}
          renderSuggestion={renderSuggestion}
          onSuggestionHighlighted={onHighlighted}
          onSuggestionsClosed={disableSelector}
          onTextChanged={onTextChanged}
        />
      </div>
    </div>
  );
};

export default SelectorSelectorWidget;
