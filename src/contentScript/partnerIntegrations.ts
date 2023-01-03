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

import { getPartnerPrincipals } from "@/background/messenger/api";

const INTEGRATION_ATTR = "data-pb-integration-userid";

async function markPartnerIntegrations() {
  const principals = await getPartnerPrincipals();

  const principal = principals.find(
    (principal) => principal.hostname === location.hostname
  );
  if (principal) {
    document.documentElement.setAttribute(
      INTEGRATION_ATTR,
      principal.principalId
    );
  }
}

export function initPartnerIntegrations() {
  void markPartnerIntegrations();
}
