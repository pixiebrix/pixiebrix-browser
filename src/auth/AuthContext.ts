/*
 * Copyright (C) 2020 Pixie Brix, LLC
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import React from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { isExtensionContext } from "@/chrome";
import { AuthState } from "@/core";

if (!isExtensionContext()) {
  console.debug("Setting axios web app authentication context");
  axios.defaults.headers.post["X-CSRFToken"] = Cookies.get("csrftoken");
}

const anonAuthState: AuthState = {
  userId: undefined,
  email: undefined,
  isLoggedIn: false,
  isOnboarded: false,
  extension: false,
  scope: null,
  flags: [],
};

const AuthContext = React.createContext(anonAuthState);

export default AuthContext;
