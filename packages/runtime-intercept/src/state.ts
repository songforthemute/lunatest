import type { RuntimeInterceptHandle } from "./types.js";

let activeHandle: RuntimeInterceptHandle | null = null;

export function getActiveRuntimeHandle(): RuntimeInterceptHandle | null {
  return activeHandle;
}

export function setActiveRuntimeHandle(handle: RuntimeInterceptHandle | null): void {
  activeHandle = handle;
}
