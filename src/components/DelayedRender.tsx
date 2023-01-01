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

import React, { useState, useEffect } from "react";

type Props = {
  millis: number;
};

/** Component used to reduce flashing */
const DelayedRender: React.FC<Props> = ({ children, millis }) => {
  const [isShown, setIsShown] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setIsShown(true);
    }, millis);
  }, [millis]);

  // The hidden element allows us to preload the content (and images) while hidden. Replacing this with `null` defeats the purpose of this component
  return isShown ? <>{children}</> : <div hidden>{children}</div>;
};

export default DelayedRender;
