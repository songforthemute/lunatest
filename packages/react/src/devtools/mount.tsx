import React from "react";
import { createRoot, type Root } from "react-dom/client";

import { LunaDevtoolsPanel } from "./LunaDevtoolsPanel.js";

export type MountLunaDevtoolsOptions = {
  targetId?: string;
  nodeEnv?: string;
  panelProps?: React.ComponentProps<typeof LunaDevtoolsPanel>;
};

const DEFAULT_TARGET_ID = "lunatest-devtools-root";
let activeRoot: Root | null = null;
let activeTarget: HTMLElement | null = null;

function resolveNodeEnv(explicit?: string): string | undefined {
  if (explicit) {
    return explicit;
  }

  if (typeof process !== "undefined") {
    return process.env.NODE_ENV;
  }

  return undefined;
}

export function mountLunaDevtools(
  options: MountLunaDevtoolsOptions = {},
): (() => void) | null {
  if (typeof document === "undefined") {
    return null;
  }

  const nodeEnv = resolveNodeEnv(options.nodeEnv);
  if (nodeEnv !== "development") {
    return null;
  }

  const targetId = options.targetId ?? DEFAULT_TARGET_ID;
  const existing = document.getElementById(targetId);
  const target = existing ?? document.createElement("div");

  if (!existing) {
    target.id = targetId;
    document.body.appendChild(target);
  }

  if (activeRoot) {
    activeRoot.unmount();
    activeRoot = null;
  }

  activeRoot = createRoot(target);
  activeTarget = target;
  activeRoot.render(React.createElement(LunaDevtoolsPanel, options.panelProps));

  return () => {
    if (!activeRoot || !activeTarget) {
      return;
    }

    activeRoot.unmount();
    if (activeTarget.id === DEFAULT_TARGET_ID) {
      activeTarget.remove();
    }
    activeRoot = null;
    activeTarget = null;
  };
}
