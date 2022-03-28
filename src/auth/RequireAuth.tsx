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

import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import Loader from "@/components/Loader";
import { ApiError, useGetMeQuery } from "@/services/api";
import { updateUserData } from "@/auth/token";
import {
  selectExtensionAuthState,
  selectUserDataUpdate,
} from "@/auth/authUtils";
import { authActions } from "@/auth/authSlice";
import { anonAuth } from "@/auth/authConstants";
import { selectIsLoggedIn } from "@/auth/authSelectors";
import { Me } from "@/types/contract";

type RequireAuthProps = {
  /** Rendered in case of 401 response */
  LoginPage: React.VFC;

  /** Rendered request to `/me` fails */
  ErrorPage?: React.VFC<{ error: unknown }>;
};

const RequireAuth: React.FC<RequireAuthProps> = ({
  children,
  LoginPage,
  ErrorPage,
}) => {
  const dispatch = useDispatch();

  const isLoggedIn = useSelector(selectIsLoggedIn);
  const { isLoading, error, data: me } = useGetMeQuery();

  useEffect(() => {
    // Before we get the very first response from API, do nothing, use the cached version.
    if (isLoading) {
      return;
    }

    const setAuth = async (me: Me) => {
      const update = selectUserDataUpdate(me);
      await updateUserData(update);

      if (me?.id) {
        const auth = selectExtensionAuthState(me);
        dispatch(authActions.setAuth(auth));
      } else {
        dispatch(authActions.setAuth(anonAuth));
      }
    };

    void setAuth(me);
  }, [isLoading, me, dispatch]);

  // Show SetupPage if there is auth error or user not logged in
  if ((error as ApiError)?.status === 401 || (!isLoggedIn && !isLoading)) {
    return <LoginPage />;
  }

  if (error) {
    if (ErrorPage) {
      return <ErrorPage error={error} />;
    }

    throw error;
  }

  // Optimistically skip waiting if we have cached auth data
  if (!isLoggedIn && isLoading) {
    return <Loader />;
  }

  return <>{children}</>;
};

export default RequireAuth;
