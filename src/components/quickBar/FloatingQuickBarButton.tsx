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

import React from "react";
import EmotionShadowRoot from "react-shadow/emotion";
import { Stylesheets } from "@/components/Stylesheets";
import styles from "./FloatingQuickBarButton.module.scss?loadAsUrl";
import logoUrl from "@/icons/custom-icons/logo.svg";
import bootstrap from "bootstrap/dist/css/bootstrap.min.css?loadAsUrl";
import { Button } from "react-bootstrap";
import { toggleQuickBar } from "@/components/quickBar/QuickBarApp";
import { useSettings } from "@/hooks/useSettings";

/**
 * Button that appears at the bottom left part of the page with the pixiebrix logo.
 * Meant to open the quickbar menu
 */
export function FloatingQuickBarButton() {
  const { isFloatingActionButtonEnabled } = useSettings();

  return isFloatingActionButtonEnabled ? (
    <EmotionShadowRoot.div>
      <Stylesheets href={[bootstrap, styles]}>
        <Button className="button" onClick={toggleQuickBar}>
          {/* <img> tag since we're using a different svg than the <Logo> component and it overrides all the styles
              anyway */}
          <img src={logoUrl} className="logo" alt="quick menu button" />
        </Button>
      </Stylesheets>
    </EmotionShadowRoot.div>
  ) : null;
}
