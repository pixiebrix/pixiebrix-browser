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

import { useEffect, useMemo } from "react";
import { selectSettings } from "@/store/settingsSelectors";
import settingsSlice from "@/store/settingsSlice";
import { useDispatch, useSelector } from "react-redux";
import { DEFAULT_THEME, Theme } from "@/options/types";
import { activatePartnerTheme } from "@/background/messenger/api";
import { persistor } from "@/options/store";
import { useAsyncState } from "@/hooks/common";
import { ManualStorageKey, readStorage } from "@/chrome";
import {
  addThemeClassToDocumentRoot,
  getThemeLogo,
  isValidTheme,
  setThemeFavicon,
  ThemeLogo,
} from "@/utils/themeUtils";
import { useGetMeQuery } from "@/services/api";
import { selectAuth } from "@/auth/authSelectors";

const MANAGED_PARTNER_ID_KEY = "partnerId" as ManualStorageKey;

const activateBackgroundTheme = async (): Promise<void> => {
  // Flush the Redux state to localStorage to ensure the background page sees the latest state
  await persistor.flush();
  await activatePartnerTheme();
};

export const useGetTheme = (): Theme => {
  const { theme, partnerId } = useSelector(selectSettings);
  const { data: me } = useGetMeQuery();
  const { partner: cachedPartner } = useSelector(selectAuth);
  const dispatch = useDispatch();

  const partnerTheme = useMemo(() => {
    if (me) {
      return isValidTheme(me.partner?.theme) ? me.partner?.theme : null;
    }

    return isValidTheme(cachedPartner?.theme) ? cachedPartner?.theme : null;
  }, [me, cachedPartner?.theme]);

  // Read from the browser's managed storage. The IT department can set as part of distributing the browser extension
  // so the correct theme is applied before authentication.
  const [managedPartnerId, isLoading] = useAsyncState(
    readStorage(MANAGED_PARTNER_ID_KEY, undefined, "managed"),
    [],
    null
  );

  useEffect(() => {
    if (partnerId === null && !isLoading) {
      // Initialize initial partner id with the one in managed storage, if any
      dispatch(
        settingsSlice.actions.setPartnerId({
          partnerId: managedPartnerId ?? "",
        })
      );
    }
  }, [partnerId, dispatch, isLoading, managedPartnerId]);

  useEffect(() => {
    dispatch(
      settingsSlice.actions.setTheme({
        theme: partnerTheme ?? partnerId ?? DEFAULT_THEME,
      })
    );
  }, [dispatch, me, partnerId, partnerTheme, theme]);

  return theme;
};

const useTheme = (theme?: Theme): { logo: ThemeLogo } => {
  const inferredTheme = useGetTheme();
  const themeLogo = getThemeLogo(theme ?? inferredTheme);

  useEffect(() => {
    void activateBackgroundTheme();
    addThemeClassToDocumentRoot(theme ?? inferredTheme);
    setThemeFavicon(theme ?? inferredTheme);
  }, [theme, inferredTheme]);

  return {
    logo: themeLogo,
  };
};

export default useTheme;
