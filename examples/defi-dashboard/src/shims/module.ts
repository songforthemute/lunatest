export function createRequire() {
  return () => {
    throw new Error("Node createRequire is unavailable in the browser demo");
  };
}
