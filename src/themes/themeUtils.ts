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

import { DEFAULT_THEME, type Theme, THEMES } from "@/themes/themeTypes";
import logo from "@img/logo.svg";
import logoSmall from "@img/logo-small.svg";
import aaLogo from "@img/aa-logo.svg";
import aaLogoSmall from "@img/aa-logo-small.svg";

export const isValidTheme = (theme: string): theme is Theme =>
  THEMES.includes(theme as Theme);

export type ThemeLogo = {
  regular: string;
  small: string;
};

type ThemeLogoMap = {
  [key in Theme]: ThemeLogo;
};

export const THEME_LOGOS: ThemeLogoMap = {
  default: {
    regular: logo,
    small: logoSmall,
  },
  "automation-anywhere": {
    regular: aaLogo,
    small: aaLogoSmall,
  },
};

// Note: this function is re-used in the app. Should not reference
// anything unavailable in the app environment, e.g. the background page
export const getThemeLogo = (theme: string): ThemeLogo => {
  if (isValidTheme(theme)) {
    // eslint-disable-next-line security/detect-object-injection -- theme is type Theme, a union type of string literal
    return THEME_LOGOS[theme];
  }

  // eslint-disable-next-line security/detect-object-injection -- theme not user defined
  return THEME_LOGOS[DEFAULT_THEME];
};

// Note: this function is re-used in the app. Should not reference
// anything unavailable in the app environment, e.g. the background page
export const addThemeClassToDocumentRoot = (theme: Theme): void => {
  for (const theme of THEMES) {
    document.documentElement.classList.remove(theme);
  }

  if (theme && theme !== DEFAULT_THEME) {
    document.documentElement.classList.add(theme);
  }
};

export const setThemeFavicon = (theme: Theme): void => {
  const favicon = document.querySelector("link[rel='icon']");
  if (!favicon) {
    // Not all pages have favicons
    return;
  }

  if (theme === "default") {
    favicon.removeAttribute("href");
  } else {
    const { small: icon } = getThemeLogo(theme);
    favicon.setAttribute("href", icon);
  }
};
