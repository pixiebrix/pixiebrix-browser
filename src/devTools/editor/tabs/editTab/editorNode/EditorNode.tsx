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

import React from "react";
import styles from "./EditorNode.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconProp } from "@fortawesome/fontawesome-svg-core";
import cx from "classnames";
import {
  faArrowDown,
  faArrowUp,
  faExclamationCircle,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import { NodeId } from "@/devTools/editor/tabs/editTab/editorNodeLayout/EditorNodeLayout";

export type EditorNodeProps = {
  nodeId?: NodeId;
  title: string;
  outputKey?: string;
  icon?: IconProp | React.ReactNode;
  onClick?: () => void;
  muted?: boolean;
  active?: boolean;
  hasError?: boolean;
  hasWarning?: boolean;
  canMoveAnything?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onClickMoveUp?: () => void;
  onClickMoveDown?: () => void;
};

function isFontAwesomeIcon(
  maybeIcon: IconProp | React.ReactNode
): maybeIcon is IconProp {
  return (
    typeof maybeIcon === "string" ||
    (typeof maybeIcon === "object" && "icon" in maybeIcon)
  );
}

const EditorNode: React.FC<EditorNodeProps> = ({
  onClick,
  icon: iconProp,
  title,
  outputKey,
  muted,
  active,
  hasError,
  hasWarning,
  canMoveAnything,
  canMoveUp,
  canMoveDown,
  onClickMoveUp,
  onClickMoveDown,
}) => {
  const outputName = outputKey ? `@${outputKey}` : "";

  const icon = isFontAwesomeIcon(iconProp) ? (
    <FontAwesomeIcon icon={iconProp as IconProp} size="2x" fixedWidth />
  ) : (
    iconProp
  );

  const errorBadge =
    hasError || hasWarning ? (
      <span className={cx("fa-layers", "fa-fw", styles.errorBadge)}>
        <span className={styles.exclamationBackground} />
        <FontAwesomeIcon
          icon={hasError ? faExclamationCircle : faExclamationTriangle}
          className={cx({
            [styles.errorBadgeBackground]: hasError,
            [styles.warningBadgeBackground]: hasWarning,
          })}
        />
      </span>
    ) : null;

  return (
    // Use our own custom style here, not bootstrap
    <div className={styles.root}>
      <div
        className={cx(styles.title, {
          [styles.addRightMargin]: canMoveAnything,
        })}
      >
        {title}
      </div>
      <div className={styles.buttonRow}>
        <button
          type="button"
          onClick={onClick}
          className={cx(styles.nodeButton, {
            [styles.mutedNode]: muted,
            [styles.activeNode]: active,
          })}
        >
          {errorBadge}
          {icon}
        </button>
        {canMoveAnything && (
          <div className={styles.moveButtons}>
            {(canMoveUp || canMoveDown) && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClickMoveUp();
                  }}
                  disabled={!canMoveUp}
                >
                  <FontAwesomeIcon icon={faArrowUp} size="sm" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClickMoveDown();
                  }}
                  disabled={!canMoveDown}
                >
                  <FontAwesomeIcon icon={faArrowDown} size="sm" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <div
        className={cx(styles.outputKey, {
          [styles.addRightMargin]: canMoveAnything,
        })}
      >
        {outputName}
      </div>
    </div>
  );
};

export default EditorNode;
