/*
 * Copyright (C) 2024 PixieBrix, Inc.
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

import React, { useMemo } from "react";
import EllipsisMenu, {
  type EllipsisMenuItem,
} from "@/components/ellipsisMenu/EllipsisMenu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHammer,
  faList,
  faShare,
  faStore,
  faSyncAlt,
  faTimes,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import useModsPageActions from "@/extensionConsole/pages/mods/hooks/useModsPageActions";
import PublishIcon from "@/icons/arrow-up-from-bracket-solid.svg?loadAsComponent";
import { type ModViewItem } from "@/types/modTypes";

const ModsPageActions: React.FunctionComponent<{
  modViewItem: ModViewItem;
}> = ({ modViewItem }) => {
  const actions = useModsPageActions(modViewItem);

  const { hasUpdate } = modViewItem;

  const actionItems = useMemo(
    (): EllipsisMenuItem[] =>
      [
        actions.viewPublish && {
          title: "Publish to Marketplace",
          // Applying the same classes which <FontAwesomeIcon/> applies
          icon: <PublishIcon className="svg-inline--fa fa-w-16 fa-fw" />,
          action: actions.viewPublish,
        },
        actions.viewInMarketplaceHref && {
          title: "View Mod Details",
          icon: <FontAwesomeIcon fixedWidth icon={faStore} />,
          href: actions.viewInMarketplaceHref,
        },
        actions.viewShare && {
          title: "Share with Teams",
          icon: <FontAwesomeIcon fixedWidth icon={faShare} />,
          action: actions.viewShare,
        },
        actions.viewLogs && {
          title: "View Logs",
          icon: <FontAwesomeIcon fixedWidth icon={faList} />,
          action: actions.viewLogs,
        },
        actions.editInWorkshop && {
          title: "Edit in Workshop",
          icon: <FontAwesomeIcon fixedWidth icon={faHammer} />,
          action: actions.editInWorkshop,
        },
        actions.reactivate && {
          title: hasUpdate ? "Update" : "Reactivate",
          icon: <FontAwesomeIcon fixedWidth icon={faSyncAlt} />,
          action: actions.reactivate,
          className: "text-info",
        },
        actions.deactivate && {
          title: "Deactivate",
          icon: <FontAwesomeIcon fixedWidth icon={faTimes} />,
          action: actions.deactivate,
          className: "text-danger",
        },
        actions.delete && {
          title: "Delete",
          icon: <FontAwesomeIcon fixedWidth icon={faTrash} />,
          action: actions.delete,
          className: "text-danger",
        },
      ].filter(Boolean),
    [actions, hasUpdate],
  );

  return <EllipsisMenu ariaLabel="mods-page-actions" items={actionItems} />;
};

export default ModsPageActions;
