import React, { type ReactNode } from "react";
import ModLauncher from "@/sidebar/modLauncher/ModLauncher";

export const STATIC_PANEL_BODY_MAP: Record<string, ReactNode> = {
  modLauncher: <ModLauncher />,
};

export function getBodyForStaticPanel(key: string): ReactNode {
  // eslint-disable-next-line security/detect-object-injection -- key is not user generated
  return STATIC_PANEL_BODY_MAP[key];
}
