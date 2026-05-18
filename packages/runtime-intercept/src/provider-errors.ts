export type LunaProviderErrorCode = 4001 | 4100 | 4200 | 4900 | 4901 | 4902;

class LunaProviderError extends Error {
  readonly code: LunaProviderErrorCode;
  readonly data?: unknown;

  constructor(code: LunaProviderErrorCode, message: string, data?: unknown) {
    super(message);
    this.name = "LunaProviderError";
    this.code = code;
    this.data = data;
  }
}

export function createProviderError(
  code: LunaProviderErrorCode,
  message: string,
  data?: unknown,
): Error & { code: LunaProviderErrorCode; data?: unknown } {
  return new LunaProviderError(code, message, data);
}
