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

import React from "react";
import Centered from "@/pageEditor/components/Centered";
import styles from "./Pane.module.scss";

const RestrictedPane: React.VoidFunctionComponent = () => (
  <Centered>
    <div className={styles.title}>
      Your team admin has restricted access to the Page Editor
    </div>
    <p>Contact your admin to receive access</p>
  </Centered>
);

export default RestrictedPane;
