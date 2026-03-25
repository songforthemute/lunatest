export function createRequire() {
  return () => {
    throw new Error("createRequire is unavailable in the browser runtime.");
  };
}
