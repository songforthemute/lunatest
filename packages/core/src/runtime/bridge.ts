function typeName(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function cloneSupported(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item === undefined) {
        throw new Error("Unsupported value type in array: undefined");
      }

      return cloneSupported(item);
    });
  }

  if (isPlainObject(value)) {
    const cloned: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(value)) {
      if (nested === undefined) {
        continue;
      }

      Object.defineProperty(cloned, key, {
        value: cloneSupported(nested),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }

    return cloned;
  }

  throw new Error(`Unsupported value type: ${typeName(value)}`);
}

export function toLuaArgs<T>(value: T): T {
  return cloneSupported(value) as T;
}

export function fromLuaValue<T>(value: T): T {
  return cloneSupported(value) as T;
}
